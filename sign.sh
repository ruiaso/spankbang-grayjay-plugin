#!/bin/sh

# Parameters
JS_FILE_PATH=$1
CONFIG_FILE_PATH=$2

# Function to fetch Spankbang user data
fetch_spankbang_data() {
    SPANKBANG_USERNAME="${SPANKBANG_USERNAME:-your_username}"
    SPANKBANG_PASSWORD="${SPANKBANG_PASSWORD:-your_password}"
    SPANKBANG_LOGIN_URL="https://spankbang.com/login"
    SPANKBANG_API_BASE="https://spankbang.com/api"
    GRAYJAY_DATA_DIR="/path/to/grayjay/data"

    # Authenticate and get session cookie
    LOGIN_RESPONSE=$(curl -s -c - "$SPANKBANG_LOGIN_URL" \
        -d "username=$SPANKBANG_USERNAME" \
        -d "password=$SPANKBANG_PASSWORD")

    SESSION_COOKIE=$(echo "$LOGIN_RESPONSE" | grep -i "session_cookie" | awk '{print $NF}')

    if [ -z "$SESSION_COOKIE" ]; then
        echo "Error: Failed to authenticate. Check your credentials or the login endpoint."
        exit 1
    fi

    # Fetch user data
    curl -s -b "session_cookie=$SESSION_COOKIE" "$SPANKBANG_API_BASE/user/history" > "$GRAYJAY_DATA_DIR/history.json"
    curl -s -b "session_cookie=$SESSION_COOKIE" "$SPANKBANG_API_BASE/user/playlists" > "$GRAYJAY_DATA_DIR/playlists.json"
    curl -s -b "session_cookie=$SESSION_COOKIE" "$SPANKBANG_API_BASE/user/subscriptions" > "$GRAYJAY_DATA_DIR/subscriptions.json"

    echo "Data fetched successfully. Files saved to $GRAYJAY_DATA_DIR."
}

# Function to generate cryptographic signature
generate_signature() {
    # Decode and save the private key to a temporary file
    echo "$SIGNING_PRIVATE_KEY" | base64 -d > tmp_private_key.pem

    # Validate private key
    if ! openssl rsa -check -noout -in tmp_private_key.pem > /dev/null 2>&1; then
        echo "Invalid private key."
        rm tmp_private_key.pem
        exit 1
    fi

    # Generate signature for the provided JS file
    SIGNATURE=$(cat $JS_FILE_PATH | openssl dgst -sha512 -sign tmp_private_key.pem | base64 -w 0)

    # Extract public key from the temporary private key file
    PUBLIC_KEY=$(openssl rsa -pubout -outform DER -in tmp_private_key.pem 2>/dev/null | openssl pkey -pubin -inform DER -outform PEM | tail -n +2 | head -n -1 | tr -d '\n')

    # Remove temporary key files
    rm tmp_private_key.pem

    # Update "scriptSignature" and "scriptPublicKey" fields in Config JSON
    cat $CONFIG_FILE_PATH | jq --arg signature "$SIGNATURE" --arg publicKey "$PUBLIC_KEY" '. + {scriptSignature: $signature, scriptPublicKey: $publicKey}' > temp_config.json && mv temp_config.json $CONFIG_FILE_PATH

    echo "Signature generated and configuration updated successfully."
}

# Main script
fetch_spankbang_data
generate_signature
