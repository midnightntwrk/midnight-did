import { spawnSync } from "node:child_process";
import { accessSync, constants, realpathSync, statSync } from "node:fs";
import { delimiter, join } from "node:path";

const DROP_GUARD = String.raw`
expected_uid=$1
expected_gid=$2
shift 2
status=/proc/self/status
[ -r "$status" ] || {
  printf '%s\n' 'sandbox privilege-drop guard cannot read /proc/self/status' >&2
  exit 125
}
while IFS=':' read -r key value; do
  case "$key" in
    Uid) uid_fields=$value ;;
    Gid) gid_fields=$value ;;
    Groups) group_fields=$value ;;
    NoNewPrivs) no_new_privs=$value ;;
  esac
done < "$status"
read -r uid_real uid_effective uid_saved uid_fs <<EOF
$uid_fields
EOF
[ "$uid_real" = "$expected_uid" ] && [ "$uid_effective" = "$expected_uid" ] && [ "$uid_saved" = "$expected_uid" ] && [ "$uid_fs" = "$expected_uid" ] && [ "$uid_effective" != 0 ] || {
  printf '%s\n' 'sandbox privilege-drop guard rejected effective UID' >&2
  exit 125
}
read -r gid_real gid_effective gid_saved gid_fs <<EOF
$gid_fields
EOF
[ "$gid_real" = "$expected_gid" ] && [ "$gid_effective" = "$expected_gid" ] && [ "$gid_saved" = "$expected_gid" ] && [ "$gid_fs" = "$expected_gid" ] || {
  printf '%s\n' 'sandbox privilege-drop guard rejected effective GID' >&2
  exit 125
}
read -r first_group remaining_groups <<EOF
$group_fields
EOF
[ -z "$first_group" ] && [ -z "$remaining_groups" ] || {
  printf '%s\n' 'sandbox privilege-drop guard found supplementary groups' >&2
  exit 125
}
read -r no_new_privs_value trailing_value <<EOF
$no_new_privs
EOF
[ "$no_new_privs_value" = 1 ] && [ -z "$trailing_value" ] || {
  printf '%s\n' 'sandbox privilege-drop guard found no-new-privileges disabled' >&2
  exit 125
}
exec "$@"
`;

const trustedUtility = (name, versionPattern) => {
  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    if (!directory) continue;
    try {
      const path = realpathSync(join(directory, name));
      accessSync(path, constants.X_OK);
      const stat = statSync(path);
      if (!stat.isFile() || stat.uid !== 0 || (stat.mode & 0o022) !== 0)
        continue;
      if (versionPattern) {
        const result = spawnSync(path, ["--version"], {
          encoding: "utf8",
          timeout: 5_000,
        });
        if (
          result.status !== 0 ||
          !versionPattern.test(`${result.stdout ?? ""}${result.stderr ?? ""}`)
        )
          continue;
      }
      return path;
    } catch {
      // Try the next trusted PATH entry.
    }
  }
  throw new Error(`Required trusted isolation utility is unavailable: ${name}`);
};

const trustedShell = () => {
  const path = realpathSync("/bin/sh");
  const stat = statSync(path);
  if (!stat.isFile() || stat.uid !== 0 || (stat.mode & 0o022) !== 0) {
    throw new Error(
      "Required trusted isolation utility is unavailable: /bin/sh",
    );
  }
  return path;
};

const environmentArguments = (environment) =>
  Object.entries(environment)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => {
      if (
        !/^[A-Z][A-Z0-9_]*$/u.test(name) ||
        typeof value !== "string" ||
        value.includes("\0")
      ) {
        throw new Error(`Unsafe environment entry for sandbox: ${name}`);
      }
      return `${name}=${value}`;
    });

export const originalRunnerIdentity = () => {
  if (
    typeof process.getuid !== "function" ||
    typeof process.getgid !== "function"
  ) {
    throw new Error("Original runner UID/GID are unavailable");
  }
  const uid = process.getuid();
  const gid = process.getgid();
  if (
    !Number.isSafeInteger(uid) ||
    !Number.isSafeInteger(gid) ||
    uid <= 0 ||
    gid <= 0
  ) {
    throw new Error(
      `Refusing external execution without a non-root original runner UID/GID (uid=${uid}, gid=${gid})`,
    );
  }
  return { gid, uid };
};

export const buildLinuxSandboxCommand = ({
  args,
  command,
  environment = {},
  identity,
  privileged,
  utilities,
}) => {
  if (
    !Number.isSafeInteger(identity?.uid) ||
    !Number.isSafeInteger(identity?.gid) ||
    identity.uid <= 0 ||
    identity.gid <= 0
  ) {
    throw new Error("Sandbox requires a non-root original runner UID/GID");
  }
  const droppedCommand = [
    "--reuid",
    String(identity.uid),
    "--regid",
    String(identity.gid),
    "--clear-groups",
    "--no-new-privs",
    "--",
    utilities.sh,
    "-ceu",
    DROP_GUARD,
    "w3c-sandbox-drop-guard",
    String(identity.uid),
    String(identity.gid),
    utilities.env,
    "-i",
    ...environmentArguments(environment),
    command,
    ...args,
  ];
  const namespaceArguments = [
    "--net",
    "--",
    utilities.setpriv,
    ...droppedCommand,
  ];
  if (!privileged) {
    return {
      args: namespaceArguments,
      command: utilities.unshare,
      kind: "linux-network-namespace-privilege-dropped",
    };
  }
  return {
    args: ["-n", utilities.unshare, ...namespaceArguments],
    command: utilities.sudo,
    kind: "linux-privileged-network-namespace-privilege-dropped",
  };
};

const linuxUtilities = () => ({
  env: trustedUtility("env", /coreutils/iu),
  setpriv: trustedUtility("setpriv", /util-linux/iu),
  sh: trustedShell(),
  unshare: trustedUtility("unshare", /util-linux/iu),
});

const usable = (sandbox) => {
  const result = spawnSync(sandbox.command, sandbox.args, {
    stdio: "ignore",
    timeout: 10_000,
  });
  return result.status === 0;
};

export const linuxNetworkSandboxCommand = (
  command,
  args,
  { environment = {} } = {},
) => {
  const identity = originalRunnerIdentity();
  const utilities = linuxUtilities();
  const probePayload = [utilities.sh, "-c", ":"];
  const directProbe = buildLinuxSandboxCommand({
    args: probePayload.slice(1),
    command: probePayload[0],
    identity,
    privileged: false,
    utilities,
  });
  if (usable(directProbe)) {
    return buildLinuxSandboxCommand({
      args,
      command,
      environment,
      identity,
      privileged: false,
      utilities,
    });
  }
  utilities.sudo = trustedUtility("sudo", /Sudo version/iu);
  const privilegedProbe = buildLinuxSandboxCommand({
    args: probePayload.slice(1),
    command: probePayload[0],
    identity,
    privileged: true,
    utilities,
  });
  if (usable(privilegedProbe)) {
    return buildLinuxSandboxCommand({
      args,
      command,
      environment,
      identity,
      privileged: true,
      utilities,
    });
  }
  throw new Error(
    "No verified Linux network namespace with privilege drop is available; refusing external execution",
  );
};

export const networkDeniedCommand = (
  command,
  args,
  { environment = {} } = {},
) => {
  if (process.platform === "darwin") {
    return {
      args: [
        "-p",
        "(version 1) (allow default) (deny network*)",
        "/usr/bin/env",
        "-i",
        ...environmentArguments(environment),
        command,
        ...args,
      ],
      command: "/usr/bin/sandbox-exec",
      kind: "macos-sandbox-exec-network-denied",
    };
  }
  if (process.platform === "linux") {
    return linuxNetworkSandboxCommand(command, args, { environment });
  }
  throw new Error(
    "No verified network-denial sandbox is available; refusing external execution",
  );
};
