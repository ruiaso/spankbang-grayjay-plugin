#!/bin/sh

# Grayjay Plugin Signing Script
# Signs the plugin JavaScript file and updates the config with signature

JS_FILE_PATH="${1:-SpankbangScript.js}"
CONFIG_FILE_PATH="${2:-SpankbangConfig.json}"

echo "Grayjay Plugin Signing Script"
echo "=============================="
echo "Script: $JS_FILE_PATH"
echo "Config: $CONFIG_FILE_PATH"
echo ""

if [ -z "$SIGNING_PRIVATE_KEY" ]; then
    echo "Error: SIGNING_PRIVATE_KEY environment variable not set."
    echo ""
    echo "Generate a key pair with:"
    echo "  openssl genrsa -out private.pem 2048"
    echo "  export SIGNING_PRIVATE_KEY=\$(base64 -w0 private.pem)"
    echo ""
    echo "Then run this script again."
    exit 1
fi

if [ ! -f "$JS_FILE_PATH" ]; then
    echo "Error: JavaScript file not found: $JS_FILE_PATH"
    exit 1
fi

if [ ! -f "$CONFIG_FILE_PATH" ]; then
    echo "Error: Config file not found: $CONFIG_FILE_PATH"
    exit 1
fi

# Decode private key
echo "$SIGNING_PRIVATE_KEY" | base64 -d > tmp_private_key.pem 2>/dev/null

if ! openssl rsa -check -noout -in tmp_private_key.pem > /dev/null 2>&1; then
    echo "Error: Invalid private key."
    rm -f tmp_private_key.pem
    exit 1
fi

echo "Private key validated."

# Generate signature
SIGNATURE=$(openssl dgst -sha512 -sign tmp_private_key.pem "$JS_FILE_PATH" | base64 -w 0)

# Extract public key (PEM format without headers)
PUBLIC_KEY=$(openssl rsa -pubout -outform PEM -in tmp_private_key.pem 2>/dev/null | grep -v "^-----" | tr -d '\n')

rm -f tmp_private_key.pem

# Update config using Node.js
node -e "
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('$CONFIG_FILE_PATH', 'utf8'));
config.scriptSignature = '$SIGNATURE';
config.scriptPublicKey = '$PUBLIC_KEY';
fs.writeFileSync('$CONFIG_FILE_PATH', JSON.stringify(config, null, 2));
"

if [ $? -eq 0 ]; then
    echo "Signature generated and config updated."
    echo ""
    echo "Signature: $(echo "$SIGNATURE" | head -c 50)..."
    echo "Public Key: $(echo "$PUBLIC_KEY" | head -c 50)..."
    echo ""
    echo "Done!"
else
    echo "Error: Failed to update config."
    exit 1
fi
