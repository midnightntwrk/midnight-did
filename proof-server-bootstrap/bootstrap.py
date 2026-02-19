import subprocess
import time


# Set the image name and the message to wait for
image_name = "midnightntwrk/proof-server:7.0.0"
message_to_wait_for = (
    "Actix runtime found; starting in Actix runtime"
)

# Start the proof-server docker instance
container_id = subprocess.check_output(
    ["docker", "run", "-d", image_name]
).decode("utf-8").strip()

print(
    f"Waiting for '{message_to_wait_for}' in container '{container_id}' logs..."
)
timeout = 600  # seconds
start_time = time.time()

# Poll the container logs until the startup message appears or timeout occurs
while True:
    output = subprocess.check_output(
        ["docker", "logs", container_id], stderr=subprocess.STDOUT
    ).decode("utf-8")
    if message_to_wait_for in output:
        break
    if time.time() - start_time > timeout:
        raise TimeoutError(
            "Startup message not found in logs within timeout."
        )
    time.sleep(1)

# Stop the container
subprocess.run(["docker", "stop", container_id])

# Commit the container to create a new docker image
new_image_name = "proof-server-bootstrap:7.0.0"
subprocess.run(["docker", "commit", container_id, new_image_name])
print(f"New image created: {new_image_name}")