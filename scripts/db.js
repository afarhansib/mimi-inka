import { world } from "@minecraft/server";

class Database {
    constructor(name) {
        this.name = name;
    }

    set(key, value) {
        const prop = world.getDynamicProperty(this._getKey(key));
        if (prop === undefined) {
            world.setDynamicProperty(this._getKey(key), JSON.stringify(value));
        } else {
            world.setDynamicProperty(this._getKey(key), JSON.stringify(value));
        }
    }

    get(key, defaultValue = null) {
        const prop = world.getDynamicProperty(this._getKey(key));
        if (prop === undefined) return defaultValue;
        try {
            return JSON.parse(prop);
        } catch {
            return prop;
        }
    }

    has(key) {
        return world.getDynamicProperty(this._getKey(key)) !== undefined;
    }

    delete(key) {
        if (this.has(key)) {
            world.setDynamicProperty(this._getKey(key), undefined);
        }
    }

    _getKey(key) {
        return `${this.name}:${key}`;
    }
}

// Database for player customizations and logs
class PlayerCustomizationDB extends Database {
    constructor() {
        super("player");
    }

    getCustomization(player, type, mode) {
        const customizations = this.get("customizations", {});
        return customizations[player]?.[mode]?.[type] ?? null;
    }

    setCustomization(player, type, value, mode) {
        const customizations = this.get("customizations", {});
        if (!customizations[player]) {
            customizations[player] = {};
        }
        if (!customizations[player][mode]) {
            customizations[player][mode] = {};
        }
        customizations[player][mode][type] = value;
        this.set("customizations", customizations);
    }

    removeCustomization(player, type, mode) {
        const customizations = this.get("customizations", {});
        if (customizations[player]?.[mode]?.[type] !== undefined) {
            delete customizations[player][mode][type];
            this.set("customizations", customizations);
        }
    }

    // Track player logins
    logPlayerJoin(player) {
        const playerLogs = this.get("playerLogs", {});
        if (!playerLogs[player.name]) {
            playerLogs[player.name] = {
                firstJoin: Date.now(),
                lastJoin: Date.now(),
                joinCount: 1
            };
        } else {
            playerLogs[player.name].lastJoin = Date.now();
            playerLogs[player.name].joinCount++;
        }
        this.set("playerLogs", playerLogs);
    }

    // Get all known players sorted by last join
    getAllPlayers() {
        const playerLogs = this.get("playerLogs", {});
        return Object.entries(playerLogs)
            .sort(([, a], [, b]) => b.lastJoin - a.lastJoin)
            .map(([name]) => name);
    }

    // Get player join info
    getPlayerInfo(name) {
        const playerLogs = this.get("playerLogs", {});
        // return playerLogs[name] || null;
        return playerLogs || null;
    }
}

// Database for mutes
export const muteDB = new Database("mute");

// Database for player customizations and logs
export const playerDB = new PlayerCustomizationDB();