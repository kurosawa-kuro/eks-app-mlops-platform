#!/bin/bash

set -euo pipefail

# Docker Hub deploy script
# Usage:
#   ./script/deploy-docker.sh <tag>
# Example:
#   ./script/deploy-docker.sh tagname
#
# It will build and push:
#   kurosawakuro/starter:<tag>

IMAGE_NAME="${IMAGE_NAME:-kurosawakuro/starter}"
TAG="${1:-latest}"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker command not found."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "$PROJECT_ROOT"

FULL_TAG="${IMAGE_NAME}:${TAG}"

echo "Building image: ${FULL_TAG}"
docker build -t "${FULL_TAG}" .

echo "Pushing image: ${FULL_TAG}"

# Best-effort login hint (newer Docker may not show Username)
if docker info 2>/dev/null | grep -qE '^ Username:'; then
  :
else
  echo "NOTE: If this fails with auth error, run: docker login"
  echo "      Or (non-interactive): echo \"\$DOCKERHUB_TOKEN\" | docker login -u <username> --password-stdin"
fi

docker push "${FULL_TAG}"

echo "Done: docker push ${FULL_TAG}"