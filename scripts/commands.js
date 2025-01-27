import { system, world } from "@minecraft/server";
import { MenuManager } from "./menu.js";
import { configManager } from "./config.js";
import { playerDB, muteDB } from "./db.js";

class CommandManager {
    constructor() {
        this.commands = new Map();
    }

    register(name, options) {
        this.commands.set(name.toLowerCase(), {
            name: name.toLowerCase(),
            description: options.description || "No description provided",
            permission: options.permission || "none", // none, admin, or custom tag
            execute: options.execute,
            aliases: (options.aliases || []).map(a => a.toLowerCase())
        });
    }

    has(name) {
        name = name.toLowerCase();
        return this.commands.has(name) ||
            [...this.commands.values()].some(cmd => cmd.aliases.includes(name));
    }

    get(name) {
        name = name.toLowerCase();
        return this.commands.get(name) ||
            [...this.commands.values()].find(cmd => cmd.aliases.includes(name));
    }

    execute(player, name, args) {
        const command = this.get(name);
        if (!command) return false;

        // Check permissions using configured tags
        if (command.permission === "admin" && !configManager.hasTag(player, "adminTag")) {
            player.sendMessage("§cYou don't have permission to use this command!");
            return true;
        }
        if (command.permission !== "none" && command.permission !== "admin" && !player.hasTag(command.permission)) {
            player.sendMessage("§cYou don't have permission to use this command!");
            return true;
        }

        try {
            command.execute(player, args);
        } catch (error) {
            player.sendMessage("§cAn error occurred while executing the command!");
            console.warn(`Error executing command ${name}: ${error}`);
        }
        return true;
    }

    getCommands() {
        return [...this.commands.values()];
    }
}

// Create and export the command manager instance
export const commandManager = new CommandManager();

// Register basic commands
commandManager.register("help", {
    description: "Shows list of available commands",
    permission: "none",
    execute: (player, args) => {
        const commands = commandManager.getCommands()
            .filter(cmd => {
                if (cmd.permission === "none") return true;
                if (cmd.permission === "admin") return configManager.hasTag(player, "adminTag");
                return player.hasTag(cmd.permission);
            });

        player.sendMessage("§6=== Available Commands ===");
        for (const cmd of commands) {
            player.sendMessage(`§e!${cmd.name}§7: ${cmd.description}`);
        }
    }
});

// Register menu command
commandManager.register("menu", {
    description: "Open the Title Manager menu",
    permission: "admin",
    aliases: ["gui", "titles"],
    execute: (player) => {
        MenuManager.openMenuWithDelay(player);
    }
});

// Register title management commands
commandManager.register("setingame", {
    description: "Set in-game customization for a player",
    permission: "admin",
    execute: (player, args) => {
        if (args.length < 3) {
            player.sendMessage([
                "§cUsage: !setingame <player> <type> <value> [position]",
                "§7Types: title, nametag",
                "§7Position (title only): top, before, after, below"
            ].join("\n"));
            return;
        }
        const [targetName, type, ...valueParts] = args;

        if (!["title", "nametag"].includes(type)) {
            player.sendMessage("§cInvalid type! Use: title, nametag");
            return;
        }

        let value, position;
        if (type === "title" && ["top", "before", "after", "below"].includes(valueParts[valueParts.length - 1])) {
            position = valueParts.pop();
            value = valueParts.join(" ");
        } else {
            value = valueParts.join(" ");
            position = "top"; // Default position
        }

        if (type === "title") {
            playerDB.setCustomization(targetName, type, { text: value, position }, "ingame");
        } else {
            playerDB.setCustomization(targetName, type, value, "ingame");
        }

        // Update in-game display if player is online
        const targetPlayer = [...world.getPlayers()].find(p => p.name === targetName);
        if (targetPlayer) {
            const currentName = type === "title"
                ? (playerDB.getCustomization(targetName, "nametag", "ingame") || targetName)
                : value;

            system.run(() => {
                // Reset nametag first
                targetPlayer.nameTag = targetName;

                if (type === "title") {
                    // Apply title with position
                    switch (position) {
                        case "top":
                            targetPlayer.nameTag = `${value}\n${currentName}`;
                            break;
                        case "before":
                            targetPlayer.nameTag = `${value} ${currentName}`;
                            break;
                        case "after":
                            targetPlayer.nameTag = `${currentName} ${value}`;
                            break;
                        case "below":
                            targetPlayer.nameTag = `${currentName}\n${value}`;
                            break;
                    }
                } else {
                    const title = playerDB.getCustomization(targetName, "title", "ingame");
                    if (title) {
                        // Apply title with new nametag
                        switch (title.position) {
                            case "top":
                                targetPlayer.nameTag = `${title.text}\n${value}`;
                                break;
                            case "before":
                                targetPlayer.nameTag = `${title.text} ${value}`;
                                break;
                            case "after":
                                targetPlayer.nameTag = `${value} ${title.text}`;
                                break;
                            case "below":
                                targetPlayer.nameTag = `${value}\n${title.text}`;
                                break;
                        }
                    } else {
                        // No title, just set nametag
                        targetPlayer.nameTag = value;
                    }
                }
            });
        }

        player.sendMessage(`§aSet in-game ${type} for ${targetName} to: ${value}${type === "title" ? ` (${position})` : ''}`);
    }
});

commandManager.register("setchat", {
    description: "Set chat customization for a player",
    permission: "admin",
    execute: (player, args) => {
        if (args.length < 3) {
            player.sendMessage([
                "§cUsage: !setchat <player> <type> <value>",
                "§7Types: title, nametag"
            ].join("\n"));
            return;
        }
        const [targetName, type, ...valueParts] = args;
        const value = valueParts.join(" ");

        if (!["title", "nametag"].includes(type)) {
            player.sendMessage("§cInvalid type! Use: title, nametag");
            return;
        }

        playerDB.setCustomization(targetName, type, value, "chat");
        player.sendMessage(`§aSet chat ${type} for ${targetName} to: ${value}`);
    }
});

commandManager.register("remove", {
    description: "Remove a customization from a player",
    permission: "admin",
    aliases: ["removecustom"],
    execute: (player, args) => {
        if (args.length < 3) {
            player.sendMessage([
                "§cUsage: !remove <player> <type> <mode>",
                "§7Types: title, nametag",
                "§7Modes: chat, ingame"
            ].join("\n"));
            return;
        }
        const [targetName, type, mode] = args;

        if (!["title", "nametag"].includes(type)) {
            player.sendMessage("§cInvalid type! Use: title, nametag");
            return;
        }

        if (!["chat", "ingame"].includes(mode)) {
            player.sendMessage("§cInvalid mode! Use: chat, ingame");
            return;
        }

        playerDB.removeCustomization(targetName, type, mode);
        player.sendMessage(`§aRemoved ${mode} ${type} for ${targetName}`);

        // Reset in-game display if applicable
        if (mode === "ingame") {
            const targetPlayer = [...world.getPlayers()].find(p => p.name === targetName);
            if (targetPlayer) {
                system.run(() => {
                    if (type === "nametag") {
                        const title = playerDB.getCustomization(targetName, "title", "ingame");
                        if (title) {
                            // Apply title with new nametag
                            switch (title.position) {
                                case "top":
                                    targetPlayer.nameTag = `${title.text}\n${targetName}`;
                                    break;
                                case "before":
                                    targetPlayer.nameTag = `${title.text} ${targetName}`;
                                    break;
                                case "after":
                                    targetPlayer.nameTag = `${targetName} ${title.text}`;
                                    break;
                                case "below":
                                    targetPlayer.nameTag = `${targetName}\n${title.text}`;
                                    break;
                            }
                        } else {
                            // No title, just set nametag
                            targetPlayer.nameTag = targetName;
                        }
                    } else if (type === "title") {
                        // Preserve nametag if exists
                        const nametag = playerDB.getCustomization(targetName, "nametag", "ingame");
                        targetPlayer.nameTag = nametag || targetName;
                    }
                });
            }
        }
    }
});

// Register mute management commands
commandManager.register("muteall", {
    description: "Toggle muting all players for yourself",
    permission: "none",
    execute: (player) => {
        let muteSettings = muteDB.get("muteSettings", {});
        muteSettings[player.name] = muteSettings[player.name] || {};
        muteSettings[player.name].muteAll = !muteSettings[player.name].muteAll;

        // If enabling muteAll, clear individual mutes to save space
        if (muteSettings[player.name].muteAll) {
            muteSettings[player.name].exceptions = [];
        }

        muteDB.set("muteSettings", muteSettings);
        player.sendMessage(muteSettings[player.name].muteAll
            ? "§aAll players will now be muted (except those you unmute)"
            : "§aAll players will now be unmuted (except those you mute)"
        );
    }
});

commandManager.register("mute", {
    description: "Mute a player for yourself",
    permission: "none",
    execute: (player, args) => {
        if (args.length < 1) {
            player.sendMessage("§cUsage: !mute <player>");
            return;
        }
        const targetName = args[0];

        let muteSettings = muteDB.get("muteSettings", {});
        muteSettings[player.name] = muteSettings[player.name] || {};

        // If muteAll is enabled, this player becomes an exception
        if (muteSettings[player.name].muteAll) {
            muteSettings[player.name].exceptions = muteSettings[player.name].exceptions || [];
            if (muteSettings[player.name].exceptions.includes(targetName)) {
                player.sendMessage(`§ePlayer ${targetName} is already muted!`);
                return;
            }
            muteSettings[player.name].exceptions = muteSettings[player.name].exceptions.filter(name => name !== targetName);
        } else {
            // Regular mute list
            muteSettings[player.name].muted = muteSettings[player.name].muted || [];
            if (muteSettings[player.name].muted.includes(targetName)) {
                player.sendMessage(`§ePlayer ${targetName} is already muted!`);
                return;
            }
            muteSettings[player.name].muted.push(targetName);
        }

        muteDB.set("muteSettings", muteSettings);
        player.sendMessage(`§aMuted player: ${targetName}`);
    }
});

commandManager.register("unmute", {
    description: "Unmute a player",
    permission: "none",
    execute: (player, args) => {
        if (args.length < 1) {
            player.sendMessage("§cUsage: !unmute <player>");
            return;
        }
        const targetName = args[0];

        let muteSettings = muteDB.get("muteSettings", {});
        muteSettings[player.name] = muteSettings[player.name] || {};

        // If muteAll is enabled, add to exceptions
        if (muteSettings[player.name].muteAll) {
            muteSettings[player.name].exceptions = muteSettings[player.name].exceptions || [];
            if (!muteSettings[player.name].exceptions.includes(targetName)) {
                muteSettings[player.name].exceptions.push(targetName);
            } else {
                player.sendMessage(`§ePlayer ${targetName} is already unmuted!`);
                return;
            }
        } else {
            // Regular mute list
            muteSettings[player.name].muted = muteSettings[player.name].muted || [];
            const index = muteSettings[player.name].muted.indexOf(targetName);
            if (index === -1) {
                player.sendMessage(`§ePlayer ${targetName} is not muted!`);
                return;
            }
            muteSettings[player.name].muted.splice(index, 1);
        }

        muteDB.set("muteSettings", muteSettings);
        player.sendMessage(`§aUnmuted player: ${targetName}`);
    }
});

commandManager.register("mutelist", {
    description: "List players you have muted",
    permission: "none",
    execute: (player) => {
        const muteSettings = muteDB.get("muteSettings", {});
        const playerSettings = muteSettings[player.name] || {};

        if (playerSettings.muteAll) {
            const exceptions = playerSettings.exceptions || [];
            if (exceptions.length === 0) {
                player.sendMessage("§6All players are muted with no exceptions!");
            } else {
                player.sendMessage("§6=== Mute Status ===");
                player.sendMessage("§7All players are muted except:");
                for (const name of exceptions) {
                    player.sendMessage(`§7- §f${name}`);
                }
            }
        } else {
            const muted = playerSettings.muted || [];
            if (muted.length === 0) {
                player.sendMessage("§eYou haven't muted any players!");
                return;
            }
            player.sendMessage("§6=== Muted Players ===");
            for (const name of muted) {
                player.sendMessage(`§7- §f${name}`);
            }
        }
    }
});

commandManager.register("alias", {
    description: "Toggle showing real player gamertags in chat",
    permission: "none",
    execute: (player) => {
        let showAlias = playerDB.get("showAlias", {});
        showAlias[player.name] = !showAlias[player.name];
        playerDB.set("showAlias", showAlias);

        player.sendMessage(showAlias[player.name]
            ? "§aReal player gamertags will now be shown in chat"
            : "§aReal player gamertags will now be hidden in chat"
        );
    }
});
