// Default configuration
const defaultConfig = {
    chatPrefix: "§l[§r§dMimi Inka§f§l]§r ",

    // Command prefixes
    prefixes: [".", "!"],

    // GUI Item settings
    guiItem: {
        typeId: "minecraft:stick",
        nameTag: "Mimi Inka"
    },

    // GUI open settings
    guiOpenDelay: 3, // seconds
    guiOpenMessage: "§6Close chat to open the menu in §e{delay}§6 seconds...",

    // Permission settings
    adminTag: "mimi",

    // Chat settings
    globalMute: false,

    // Glyph settings
    glyphPrefix: "E7", // The glyph file prefix (e.g., E7 for glyph_E7.png)
    glyphs: [], // Will be populated with generated codes
};

class ConfigManager {
    constructor() {
        this.initializeConfig();
    }

    initializeConfig() {
        this.generateGlyphs();
    }

    getDefaultConfig() {
        const config = { ...defaultConfig };
        return config;
    }

    get(key) {
        return defaultConfig[key];
    }

    set(key, value) {
        defaultConfig[key] = value;
    }

    append(key, value) {
        const current = this.get(key);
        if (Array.isArray(current)) {
            current.push(value);
            this.set(key, current);
        }
    }

    // Helper method to check if a player has a configured tag
    hasTag(player, tagType) {
        const tag = this.get(tagType);
        return player.hasTag(tag);
    }

    // Generate glyph codes from the configured prefix
    generateGlyphs() {
        const prefix = this.get("glyphPrefix");
        if (!prefix) return;

        const glyphs = [];
        // Generate codes from 00 to FF (0-255 in hex)
        for (let i = 0; i < 256; i++) {
            // Convert to hex and pad with leading zero if needed
            const hex = i.toString(16).padStart(2, '0').toUpperCase();
            // Create the Unicode character using String.fromCharCode
            const code = String.fromCharCode(parseInt(`${prefix}${hex}`, 16));
            glyphs.push(code);
        }

        // Update config
        this.set("glyphs", glyphs);
    }

    getAll() {
        const config = {};
        for (const key of Object.keys(defaultConfig)) {
            config[key] = this.get(key);
        }
        return config;
    }
}

export const configManager = new ConfigManager();

// Export default config for reference
export { defaultConfig };
