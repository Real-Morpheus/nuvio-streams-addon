const cache = new Map();
const TTL = 30 * 60 * 1000; // 30 minutes default

module.exports = {
    get: (key) => {
        const item = cache.get(key);
        if (!item) return null;
        if (Date.now() > item.expiry) {
            cache.delete(key);
            return null;
        }
        return item.value;
    },
    set: (key, value, ttl = TTL) => {
        cache.set(key, {
            value,
            expiry: Date.now() + ttl
        });
    },
    clear: () => cache.clear()
};
