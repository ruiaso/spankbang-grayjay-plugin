#!/bin/bash

# Grayjay Plugin Signing Script
# This script handles:
# 1. SpankBang session verification (optional - for authenticated features)
# 2. Cryptographic signing of the plugin for Grayjay

# Parameters
JS_FILE_PATH=${1:-"SpankbangScript.js"}
CONFIG_FILE_PATH=${2:-"SpankbangConfig.json"}
COOKIE_JAR="/tmp/spankbang_cookies.txt"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Grayjay SpankBang Plugin Signing Script${NC}"
echo "=========================================="

# SpankBang URLs
SPANKBANG_BASE="https://www.spankbang.com"
SPANKBANG_LOGIN_URL="${SPANKBANG_BASE}/users/login"
SPANKBANG_PROFILE_URL="${SPANKBANG_BASE}/users"

# Common headers to avoid bot detection
USER_AGENT="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"

# Function to verify SpankBang session (optional for testing auth)
verify_spankbang_session() {
    echo -e "\n${YELLOW}[1/2] Verifying SpankBang Session...${NC}"
    
    # Check if credentials are provided via environment variables
    if [ -z "$SPANKBANG_USERNAME" ] || [ -z "$SPANKBANG_PASSWORD" ]; then
        echo -e "${YELLOW}Note: SPANKBANG_USERNAME and SPANKBANG_PASSWORD not set.${NC}"
        echo "Skipping authentication verification."
        echo "The plugin uses browser-based login through Grayjay app."
        return 0
    fi
    
    # Step 1: Get the login page and extract CSRF token
    echo "Fetching login page..."
    LOGIN_PAGE=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
        -H "User-Agent: $USER_AGENT" \
        -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \
        -H "Accept-Language: en-US,en;q=0.5" \
        "$SPANKBANG_LOGIN_URL")
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Failed to fetch login page.${NC}"
        return 1
    fi
    
    # Extract CSRF token (SpankBang uses hidden form field)
    CSRF_TOKEN=$(echo "$LOGIN_PAGE" | grep -oP 'name="csrf_token"\s+value="\K[^"]+' | head -1)
    if [ -z "$CSRF_TOKEN" ]; then
        # Try alternative patterns
        CSRF_TOKEN=$(echo "$LOGIN_PAGE" | grep -oP 'name="_token"\s+value="\K[^"]+' | head -1)
    fi
    if [ -z "$CSRF_TOKEN" ]; then
        CSRF_TOKEN=$(echo "$LOGIN_PAGE" | grep -oP 'data-csrf="\K[^"]+' | head -1)
    fi
    
    echo "CSRF Token: ${CSRF_TOKEN:0:10}... (truncated for security)"
    
    # Step 2: Attempt login
    echo "Attempting login..."
    LOGIN_RESPONSE=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
        -X POST \
        -H "User-Agent: $USER_AGENT" \
        -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \
        -H "Accept-Language: en-US,en;q=0.5" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -H "Referer: $SPANKBANG_LOGIN_URL" \
        -H "Origin: $SPANKBANG_BASE" \
        --data-urlencode "username=$SPANKBANG_USERNAME" \
        --data-urlencode "password=$SPANKBANG_PASSWORD" \
        ${CSRF_TOKEN:+--data-urlencode "csrf_token=$CSRF_TOKEN"} \
        -L \
        "$SPANKBANG_LOGIN_URL")
    
    # Step 3: Verify login by checking for sb_session cookie
    if grep -q "sb_session" "$COOKIE_JAR" 2>/dev/null; then
        echo -e "${GREEN}Login successful! sb_session cookie obtained.${NC}"
        
        # Extract the session cookie value
        SB_SESSION=$(grep "sb_session" "$COOKIE_JAR" | awk '{print $NF}')
        echo "Session cookie: ${SB_SESSION:0:10}... (truncated)"
        
        # Verify by checking profile page
        PROFILE_CHECK=$(curl -s -b "$COOKIE_JAR" \
            -H "User-Agent: $USER_AGENT" \
            "$SPANKBANG_PROFILE_URL")
        
        if echo "$PROFILE_CHECK" | grep -q "logout\|sign.out\|log.out" 2>/dev/null; then
            echo -e "${GREEN}Session verified - authenticated successfully!${NC}"
            return 0
        else
            echo -e "${YELLOW}Warning: Login may have failed. Check credentials.${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}Note: sb_session cookie not found.${NC}"
        echo "SpankBang may be blocking automated logins."
        echo "The plugin handles login through Grayjay's browser-based auth."
        return 0
    fi
}

# Function to generate cryptographic signature for Grayjay plugin
generate_signature() {
    echo -e "\n${YELLOW}[2/2] Generating Plugin Signature...${NC}"
    
    # Check if signing key is provided
    if [ -z "$SIGNING_PRIVATE_KEY" ]; then
        echo -e "${YELLOW}Note: SIGNING_PRIVATE_KEY not set.${NC}"
        echo "To sign the plugin, set SIGNING_PRIVATE_KEY environment variable"
        echo "with your base64-encoded private key."
        echo ""
        echo "Generate a key pair with:"
        echo "  openssl genrsa -out private.pem 2048"
        echo "  export SIGNING_PRIVATE_KEY=\$(base64 -w0 private.pem)"
        return 0
    fi
    
    # Verify input files exist
    if [ ! -f "$JS_FILE_PATH" ]; then
        echo -e "${RED}Error: JavaScript file not found: $JS_FILE_PATH${NC}"
        return 1
    fi
    
    if [ ! -f "$CONFIG_FILE_PATH" ]; then
        echo -e "${RED}Error: Config file not found: $CONFIG_FILE_PATH${NC}"
        return 1
    fi
    
    # Check for required tools
    if ! command -v openssl &> /dev/null; then
        echo -e "${RED}Error: openssl is required but not installed.${NC}"
        return 1
    fi
    
    if ! command -v jq &> /dev/null; then
        echo -e "${RED}Error: jq is required but not installed.${NC}"
        echo "Install with: nix-env -iA nixpkgs.jq"
        return 1
    fi
    
    # Decode and save the private key to a temporary file
    TEMP_KEY=$(mktemp)
    echo "$SIGNING_PRIVATE_KEY" | base64 -d > "$TEMP_KEY" 2>/dev/null
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Failed to decode private key. Ensure it's base64 encoded.${NC}"
        rm -f "$TEMP_KEY"
        return 1
    fi
    
    # Validate private key
    if ! openssl rsa -check -noout -in "$TEMP_KEY" > /dev/null 2>&1; then
        echo -e "${RED}Error: Invalid RSA private key.${NC}"
        rm -f "$TEMP_KEY"
        return 1
    fi
    
    echo "Private key validated successfully."
    
    # Generate SHA-512 signature for the JavaScript file
    echo "Generating signature for: $JS_FILE_PATH"
    SIGNATURE=$(cat "$JS_FILE_PATH" | openssl dgst -sha512 -sign "$TEMP_KEY" | base64 -w 0)
    
    if [ -z "$SIGNATURE" ]; then
        echo -e "${RED}Error: Failed to generate signature.${NC}"
        rm -f "$TEMP_KEY"
        return 1
    fi
    
    echo "Signature generated (${#SIGNATURE} characters)."
    
    # Extract public key in PEM format (without headers)
    PUBLIC_KEY=$(openssl rsa -pubout -outform DER -in "$TEMP_KEY" 2>/dev/null | \
                 openssl pkey -pubin -inform DER -outform PEM 2>/dev/null | \
                 tail -n +2 | head -n -1 | tr -d '\n')
    
    if [ -z "$PUBLIC_KEY" ]; then
        echo -e "${RED}Error: Failed to extract public key.${NC}"
        rm -f "$TEMP_KEY"
        return 1
    fi
    
    echo "Public key extracted."
    
    # Remove temporary key file
    rm -f "$TEMP_KEY"
    
    # Update the config file with signature and public key
    echo "Updating config: $CONFIG_FILE_PATH"
    
    TEMP_CONFIG=$(mktemp)
    jq --arg sig "$SIGNATURE" --arg pubkey "$PUBLIC_KEY" \
       '.scriptSignature = $sig | .scriptPublicKey = $pubkey' \
       "$CONFIG_FILE_PATH" > "$TEMP_CONFIG"
    
    if [ $? -eq 0 ]; then
        mv "$TEMP_CONFIG" "$CONFIG_FILE_PATH"
        echo -e "${GREEN}Configuration updated successfully!${NC}"
        echo ""
        echo "Plugin signing complete. Updated fields:"
        echo "  - scriptSignature: ${SIGNATURE:0:40}..."
        echo "  - scriptPublicKey: ${PUBLIC_KEY:0:40}..."
    else
        echo -e "${RED}Error: Failed to update config file.${NC}"
        rm -f "$TEMP_CONFIG"
        return 1
    fi
    
    return 0
}

# Cleanup function
cleanup() {
    rm -f "$COOKIE_JAR" 2>/dev/null
    rm -f /tmp/spankbang_*.tmp 2>/dev/null
}

# Set trap for cleanup
trap cleanup EXIT

# Main execution
echo ""
echo "Files:"
echo "  Script: $JS_FILE_PATH"
echo "  Config: $CONFIG_FILE_PATH"

# Run verification (optional - will gracefully skip if no credentials)
verify_spankbang_session

# Run signature generation
generate_signature

echo ""
echo -e "${GREEN}Done!${NC}"
