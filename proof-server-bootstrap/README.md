# Instructions to bootstrap a midnight proof server

# Problem
The end-to-end tests with standalone indexer, node, and the proof-server are slow because the proof-server downloads additional resources after startup.
It's more or less stable if the internet connection is fast enough, but it might fail with the timeout of the vitests + testcontainer when the network is slow, and it might take up to 3 or 6 minutes to get all resources downloaded.

# Solution
There is a trick to speed up the docker container initialization by building a new image of the proof-server with all resources downloaded.
To do that, we need to execute the following steps:
- Start the proof-server instance.
- Wait for it to be ready (the message `Actix runtime found; starting in Actix runtime` should appear in the docker logs).
- Stop the container.
- Make a new image from the container (`docker commit <container> <image-name>`).

The steps described above are automatically executed by the `bootstrap.py` script in this directory.

Now you need to replace the default image of the proof-server with your newly created one.

## Use bootstrapped image locally via env var

This repository supports overriding the proof-server image with `PROOF_SERVER_IMAGE`.
By default, all local compose files and test helpers use:

`midnightntwrk/proof-server:7.0.0`

To run locally with the bootstrapped image created by `bootstrap.py`:

```bash
export PROOF_SERVER_IMAGE=proof-server-bootstrap:7.0.0
```

Then run your normal local workflows (for example `docker compose` or local API/CLI tests).
The override is local to your shell session.

To switch back to the default image:

```bash
unset PROOF_SERVER_IMAGE
```

Notes:
- CI does not set `PROOF_SERVER_IMAGE`, so CI continues to use the default non-bootstrapped image.
- This override is intended for local development and faster local test/container startup.
