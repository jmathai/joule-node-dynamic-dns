#!/usr/bin/env bash

# Save command line arguments to variables
USERNAME="${1}"
JOULENAME="${2}"
DOMAIN="${3}"
SECRET="${4}"
ENDPOINT="https://api.joule.run/${USERNAME}/${JOULENAME}"

# Call GET endpoint to fetch the IP address by parsing the result
GETIP=$(curl --silent ${ENDPOINT} | grep -oE '[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}')

# Generate a token by creating a signature of the ip, domain and secret
TOKEN=$(echo -n "${GETIP}:${DOMAIN}:${SECRET}" | openssl dgst -sha256)

# Call POST endpoint to update the IP address if needed
curl --silent -X POST \
  -d "token=${TOKEN}" \
  "${ENDPOINT}"
