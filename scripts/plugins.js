import { world, system } from "@minecraft/server";
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
            const player = players.find(p => p?.name === playerName);
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
            sender.setGameMode('survival')
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
            sender.setGameMode('spectator')
        })
    }
});

commandManager.register("gmc", {
    description: "Gamemode Creative",
    permission: "admin",
    aliases: ["gmc"],
    execute: (sender, args) => {
        system.run(() => {
            sender.setGameMode('creative')
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
            if (sender.getGameMode() !== 'spectator') {
                sender.setGameMode('spectator')
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
