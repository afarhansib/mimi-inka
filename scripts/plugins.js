import { world, system, GameMode } from "@minecraft/server";
import { commandManager } from "./commands";
import { playerDB } from "./db";

// Track players who have activated the TPS stream
const tpsStreamers = new Set();

commandManager.register("test", {
    description: "Custom test command example",
    permission: "admin",
    aliases: ["test"],
    execute: (sender, args) => {
        sender.sendMessage(`§eTest§f: ${args.join(" ")}`);
    }
});

commandManager.register("e", {
    description: "Check entity around players",
    permission: "admin",
    aliases: ["e"],
    execute: (sender, args) => {
        getMobs(sender)
    }
});

commandManager.register("tps", {
    description: "Check server TPS",
    permission: "none",
    aliases: ["tps"],
    execute: (sender, args) => {
        const startTime = Date.now()
        const players = world.getPlayers().length
        system.runTimeout(() => {
            const theTPS = (1000 * 20 / (Date.now() - startTime)).toFixed(2)
            sender.sendMessage("tps=" + theTPS + " players=" + players)
        }, 20)
    }
});

commandManager.register("stps", {
    description: "Stream server TPS every second",
    permission: "admin",
    aliases: ["stps"],
    execute: (sender, args) => {
        const playerName = sender.name;

        if (tpsStreamers.has(playerName)) {
            // Stop streaming TPS for the player
            tpsStreamers.delete(playerName);
            sender.sendMessage(`§cTPS streaming stopped.`);
        } else {
            // Start streaming TPS for the player
            tpsStreamers.add(playerName);
            sender.sendMessage(`§aTPS streaming started. Run §e/streamtps §ato stop.`);
        }
    }
});

// Function to calculate TPS
function calculateTPS(startTime) {
    return (1000 * 20 / (Date.now() - startTime)).toFixed(2);
}

// Periodically update TPS for active streamers
system.runInterval(() => {
    const startTime = Date.now(); // Start time for TPS calculation
    const players = world.getPlayers();

    // Calculate TPS after 20 ticks (1 second)
    system.runTimeout(() => {
        const theTPS = calculateTPS(startTime);

        // Send TPS to all active streamers
        for (const playerName of tpsStreamers) {
            // Find the player by filtering through online players
            const player = players.find(p => p && p.name === playerName);
            if (player) {
                // Create the action bar message
                const actionBarMessage = [
                    `§bTPS: §f${theTPS}`, // TPS value
                    `§7Online: §f${players.length}` // Player count
                ].join(" §r|§r "); // Join with a separator

                // Display the message in the action bar
                player.onScreenDisplay.setActionBar(actionBarMessage);
            } else {
                // Remove inactive players from the set
                tpsStreamers.delete(playerName);
            }
        }
    }, 20); // 20 ticks = 1 second delay
}, 20); // Run every second

commandManager.register("gms", {
    description: "Gamemode Survival",
    permission: "admin",
    aliases: ["gms"],
    execute: (sender, args) => {
        system.run(() => {
            sender.setGameMode(GameMode.Survival)
            sender.removeEffect('night_vision')
        })
    }
});

commandManager.register("gmp", {
    description: "Gamemode Spectator",
    permission: "admin",
    aliases: ["gmp"],
    execute: (sender, args) => {
        system.run(() => {
            sender.setGameMode(GameMode.Spectator)
        })
    }
});

commandManager.register("gmc", {
    description: "Gamemode Creative",
    permission: "admin",
    aliases: ["gmc"],
    execute: (sender, args) => {
        system.run(() => {
            sender.setGameMode(GameMode.Creative)
        })
    }
});

commandManager.register("nv", {
    description: "Night Vision.",
    permission: "admin",
    aliases: ["nv"],
    execute: (sender, args) => {
        system.run(() => {
            sender.addEffect('night_vision', 86400 * 20, {
                amplifier: 1,
                showParticles: false
            })
        })
    }
});

commandManager.register("rnv", {
    description: "Remove Night Vision.",
    permission: "admin",
    aliases: ["rnv"],
    execute: (sender, args) => {
        system.run(() => {
            sender.removeEffect('night_vision')
        })
    }
});

commandManager.register("tp", {
    description: "Teleport",
    permission: "admin",
    aliases: ["tp"],
    execute: (sender, args) => {
        const tpTarget = (args.join(' ')).split('@')[1] || args.join(' ')
        system.run(async () => {
            if (sender.getGameMode() !== GameMode.Spectator) {
                sender.setGameMode(GameMode.Spectator)
            }

            // Add delay before teleporting
            system.runTimeout(() => {
                sender.runCommand('tp @s ' + tpTarget)
            }, 40) // 40 ticks = 2 second delay
        })
    }
});

commandManager.register("ml", {
    description: "Open Mimi Land GUI",
    permission: "none",
    aliases: ["ml"],
    execute: (sender, args) => {
        system.run(() => sender.sendMessage(`§l[§r§eMimi Land§f§l]§r §aSuccess! Close this Chat GUI and wait 5 secs.`))
        try {
            system.runTimeout(() => {
                sender.runCommand('scriptevent mimi:land-gui')
            }, 20 * 5)
        } catch (err) {

        }
    }
});

world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;

    system.runTimeout(() => {
        player.sendMessage('Welcome to §aThe Server§r!')
        player.sendMessage('Ketik §d.help§r untuk bantuan server.')
    }, 40)
});

function getMobs(moderator) {
    let [globalMobs, overworldMobs, netherMobs, endMobs, playerMobs] = getMobsNearPlayers(moderator)

    // Helper function to group entities by category
    const groupEntities = (entities) => {
        let grouped = {}
        for (const [type, amount] of Object.entries(entities)) {
            // console.log(JSON.stringify(type))
            let category = type
            // let category = type.split('_')[0]
            if (!grouped[category]) {
                grouped[category] = 0
            }
            grouped[category] += amount
        }
        return grouped
    }

    // Print individual player summaries in a single line
    for (const player of playerMobs) {
        let entities = groupEntities(player.types)
        // console.log(JSON.stringify(entities))
        let summary = Object.entries(entities).map(([category, count]) => `${count}×${category}`).join(' | ')
        // console.log(JSON.stringify(summary))
        sayInChat(moderator, `§4${player.name} §b[Total:${player.count}] §e${player?.location} (${player.dimension}) - §a${summary}`)
    }
    
    // Print global statistics
    // console.log('global summary')
    let globalEntities = groupEntities(globalMobs)
    let globalSummary = Object.entries(globalEntities).map(([category, count]) => `${count}×${category}`).join(' | ')
    // console.log('after global summary')
    // console.log(JSON.stringify(globalSummary))
    sayInChat(moderator, `§6Global Statistics [Total: ${Object.values(globalMobs).reduce((a, b) => a + b, 0)}] - §a${globalSummary}`)
}

function getMobsNearPlayers(moderator) {
    let players = world.getPlayers()
    let [globalMobs, overworldMobs, netherMobs, endMobs, playerMobs] = [{}, {}, {}, {}, []]
    let counted = []

    for (const player of players) {
        const dimensionEntities = world.getDimension(player.dimension.id).getEntities({ location: player.location, maxDistance: 128 })
        let playerEntityTypes = {}

        for (const entity of dimensionEntities) {
            let mobType = (obj, type) => (obj[type] = (obj[type] || 0) + 1)

            switch (entity.dimension.id) {
                case "minecraft:overworld":
                    mobType(overworldMobs, entity.typeId)
                    break
                case "minecraft:nether":
                    mobType(netherMobs, entity.typeId)
                    break
                case "minecraft:the_end":
                    mobType(endMobs, entity.typeId)
                    break
            }

            if (!counted.includes(entity.id)) {
                mobType(globalMobs, entity.typeId)
                counted.push(entity.id)
            }
            if (entity.dimension.id === player.dimension.id) {
                mobType(playerEntityTypes, entity.typeId)
            }
        }
        let playerMobCount = Object.values(playerEntityTypes).reduce((a, b) => a + b, 0)
        // console.log(JSON.stringify(player.location))
        // Round the coordinates
        const roundedLocation = {
            x: Math.round(player.location.x),
            y: Math.round(player.location.y),
            z: Math.round(player.location.z)
        };
        playerMobs.push({
            name: player.name,
            count: playerMobCount,
            dimension: player.dimension.id.replace('minecraft:', ''),
            location: `${roundedLocation.x}, ${roundedLocation.y}, ${roundedLocation.z}`, // Rounded coordinates as a string
            types: playerEntityTypes
        })
    }
    return [globalMobs, overworldMobs, netherMobs, endMobs, playerMobs]
}


function sayInChat(target, text) {
    text = text.split("minecraft:").join("")
    target.sendMessage(text)
}

// Base64 encoding function (simplified to only what we need)
const base64 = {
    encode: function(str) {
        const input = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
            function toSolidBytes(match, p1) {
                return String.fromCharCode('0x' + p1);
            });
        
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        let output = '';
        let i = 0;
        
        while (i < input.length) {
            const chr1 = input.charCodeAt(i++);
            const chr2 = i < input.length ? input.charCodeAt(i++) : NaN;
            const chr3 = i < input.length ? input.charCodeAt(i++) : NaN;

            const enc1 = chr1 >> 2;
            const enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            const enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            const enc4 = chr3 & 63;

            output += chars.charAt(enc1) + chars.charAt(enc2) +
                     (isNaN(chr2) ? '=' : chars.charAt(enc3)) +
                     (isNaN(chr3) ? '=' : chars.charAt(enc4));
        }
        
        return output;
    },
    
    decode: function(str) {
        // First, clean the input string
        str = str.replace(/[^A-Za-z0-9+/=]/g, '');
        
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        let output = '';
        let i = 0;
        
        while (i < str.length) {
            const enc1 = chars.indexOf(str.charAt(i++));
            const enc2 = chars.indexOf(str.charAt(i++));
            const enc3 = chars.indexOf(str.charAt(i++));
            const enc4 = chars.indexOf(str.charAt(i++));

            const chr1 = (enc1 << 2) | (enc2 >> 4);
            const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            const chr3 = ((enc3 & 3) << 6) | enc4;

            output += String.fromCharCode(chr1);
            if (enc3 !== 64) output += String.fromCharCode(chr2);
            if (enc4 !== 64) output += String.fromCharCode(chr3);
        }
        
        try {
            return decodeURIComponent(output.split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
        } catch(e) {
            return output;
        }
    }
};

// To import customizations, replace this string with your base64 data
// Example: const importCustomizationsData = "eyJwbGF5ZXJzIjp7fX0=";
const importCustomizationsData = ""

// Add event handler for export
system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "mimi:export_customizations") {
        const customizations = world.getDynamicProperty("player:customizations");
        if (customizations) {
            const base64Data = base64.encode(JSON.stringify(customizations));
            console.warn("=== Customizations Export Data ===");
            console.warn(base64Data);
            console.warn("=== End of Export Data ===");
            // Add a debug print of the original data
            console.warn("=== Debug: Original Data ===");
            // console.warn(JSON.stringify(JSON.parse(customizations), null, 2));
            console.warn("=== End Debug ===");
            console.warn("To import: Replace importCustomizationsData value in plugins.js with this string");
        } else {
            console.warn("No customizations data found!");
        }
    }
});

// Import customizations on script load if data is provided
if (importCustomizationsData) {
    try {
        console.warn("=== Debug: Starting Import Process ===");
        
        // Step 1: Base64 decode using our custom function
        const decodedString = base64.decode(importCustomizationsData);
        console.warn("Step 1 - Base64 decoded length: " + decodedString.length);
        
        // Step 2: Parse JSON directly
        const customizations = JSON.parse(decodedString);
        
        // Print the decoded data
        console.warn("=== Debug: Decoded Data ===");
        console.warn(JSON.stringify(customizations, null, 2));
        console.warn("=== End Debug ===");

        // Apply the customizations
        system.run(() => {
            world.setDynamicProperty("player:customizations", customizations);
        })
        console.warn("Customizations imported successfully!");
        
    } catch (error) {
        console.warn("=== Debug: Import Error ===");
        console.warn("Error type: " + error.name);
        console.warn("Error message: " + error.message);
        console.warn("=== End Debug ===");
    }
}
