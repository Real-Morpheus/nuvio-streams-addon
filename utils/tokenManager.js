const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class TokenManager {
    constructor(filePath) {
        this.filePath = filePath || path.join(__dirname, '..', 'tokens.json');
        this.tokens = [];
        this.loadTokens();
    }

    loadTokens() {
        try {
            if (fs.existsSync(this.filePath)) {
                const data = fs.readFileSync(this.filePath, 'utf8');
                this.tokens = JSON.parse(data);
            } else {
                this.tokens = [];
                this.saveTokens();
            }
        } catch (err) {
            console.error('[TokenManager] Error loading tokens:', err);
            this.tokens = [];
        }
    }

    saveTokens() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.tokens, null, 2));
        } catch (err) {
            console.error('[TokenManager] Error saving tokens:', err);
        }
    }

    createToken(name) {
        // Generate a random 12-character alphanumeric token
        const token = crypto.randomBytes(6).toString('hex');
        const newToken = {
            token,
            name: name || 'Unnamed User',
            created: new Date().toISOString()
        };
        this.tokens.push(newToken);
        this.saveTokens();
        return newToken;
    }

    deleteToken(tokenString) {
        const initialLength = this.tokens.length;
        this.tokens = this.tokens.filter(t => t.token !== tokenString);
        if (this.tokens.length !== initialLength) {
            this.saveTokens();
            return true;
        }
        return false;
    }

    isValid(tokenString) {
        return this.tokens.some(t => t.token === tokenString);
    }

    getAllTokens() {
        return this.tokens;
    }
}

module.exports = TokenManager;
