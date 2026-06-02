from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError:
    print("Missing Python package: pypdf. Install it with: python -m pip install pypdf", file=sys.stderr)
    raise


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF = ROOT / "docs" / "__Storm King's Thunder (1-10).pdf"
DEFAULT_OUT = ROOT / "content" / "private" / "storm-kings-thunder" / "module.json"


MILESTONES = [
    ("ch01-nightstone", "Chapter 1: A Great Upheaval", "Nightstone", "social", "Reach Nightstone and learn what crisis emptied the settlement.", ["Enter cautiously", "Search for survivors", "Inspect the damage"], ["goblin", "goblin", "hobgoblin"]),
    ("ch01-dripping-caves", "Chapter 1: A Great Upheaval", "Dripping Caves", "exploration", "Follow the missing villagers' trail and resolve the cave rescue.", ["Track the captives", "Sneak into the caves", "Negotiate before fighting"], ["goblin", "goblin", "ogre"]),
    ("ch01-zephyros", "Chapter 1: A Great Upheaval", "Tower of Zephyros", "social", "Accept strange giant-sized aid and establish the campaign's giant threat.", ["Question Zephyros", "Study the tower", "Prepare for the next town"], ["ogre"]),
    ("ch02-bryn-shander", "Chapter 2: Rumblings", "Bryn Shander", "social", "Defend Bryn Shander and earn leads into the wider giant crisis.", ["Meet local leaders", "Man the defenses", "Pursue faction leads"], ["orc", "orc", "ogre"]),
    ("ch02-goldenfields", "Chapter 2: Rumblings", "Goldenfields", "social", "Protect Goldenfields and collect hooks tied to the North.", ["Warn the abbey", "Rally defenders", "Follow raider clues"], ["goblin", "ogre", "hill_giant"]),
    ("ch02-triboar", "Chapter 2: Rumblings", "Triboar", "social", "Defend Triboar and discover why giants are raiding settled lands.", ["Question townsfolk", "Guard the market", "Investigate the dig site"], ["orc", "ogre", "fire_giant"]),
    ("ch03-north-travel", "Chapter 3: The Savage Frontier", "The Savage Frontier", "exploration", "Travel the North, choose faction leads, and turn rumors into destinations.", ["Follow a faction lead", "Research a location", "Scout the wilderness"], ["wolf", "orc", "ogre"]),
    ("ch03-featured-encounter", "Chapter 3: The Savage Frontier", "Featured Encounters", "combat", "Survive a major wilderness complication and secure the next lead.", ["Fight through", "Create a diversion", "Retreat and regroup"], ["orc", "ogre", "hill_giant"]),
    ("ch04-eye-approach", "Chapter 4: The Chosen Path", "Eye of the All-Father", "exploration", "Reach the Eye of the All-Father and learn how the giant lords connect.", ["Navigate the mountains", "Question giant lore", "Open the way inside"], ["ogre", "stone_giant"]),
    ("ch04-eye-revelation", "Chapter 4: The Chosen Path", "Eye of the All-Father", "social", "Use the oracle to choose which giant lord's stronghold to pursue.", ["Ask about the ordning", "Choose a giant lord", "Prepare for pursuit"], ["stone_giant"]),
    ("ch04-airship", "Chapter 4: The Chosen Path", "Airship of a Cult", "social", "Secure transportation and decide how to use uneasy allies.", ["Accept the airship", "Set terms", "Plan the assault route"], ["bandit", "bandit", "orc"]),
    ("ch05-grudd-haug", "Chapter 5: Den of the Hill Giants", "Grudd Haug", "exploration", "Infiltrate Grudd Haug and find the hill giant lord's objective.", ["Sneak through the den", "Sabotage supplies", "Challenge the chief"], ["ogre", "hill_giant"]),
    ("ch05-hill-giant-showdown", "Chapter 5: Den of the Hill Giants", "Grudd Haug", "combat", "Defeat or outmaneuver the hill giant leadership.", ["Press the attack", "Exploit the feast hall", "Force a surrender"], ["hill_giant"]),
    ("ch06-deadstone-cleft", "Chapter 6: Canyon of the Stone Giants", "Deadstone Cleft", "exploration", "Enter Deadstone Cleft and uncover the stone giants' destructive purpose.", ["Climb the canyon", "Read old signs", "Avoid patrols"], ["ogre", "stone_giant"]),
    ("ch06-stone-giant-showdown", "Chapter 6: Canyon of the Stone Giants", "Deadstone Cleft", "combat", "Stop the stone giant thane's plan or escape with decisive evidence.", ["Fight the thane", "Break the ritual focus", "Use the terrain"], ["stone_giant"]),
    ("ch07-svardborg", "Chapter 7: Berg of the Frost Giants", "Svardborg", "exploration", "Scout Svardborg and learn what the frost giants are hunting.", ["Approach over ice", "Spy on the lodges", "Search the ship"], ["ogre", "frost_giant"]),
    ("ch07-krigvind", "Chapter 7: Berg of the Frost Giants", "The Krigvind", "combat", "Confront the frost giant forces around their ship and captive prize.", ["Board the ship", "Free a prisoner", "Break the chain of command"], ["frost_giant"]),
    ("ch08-ironslag-upper", "Chapter 8: Forge of the Fire Giants", "Ironslag", "exploration", "Infiltrate Ironslag and identify the fire giants' war-machine project.", ["Enter through the mines", "Free prisoners", "Sabotage machinery"], ["orc", "ogre", "fire_giant"]),
    ("ch08-ironslag-lower", "Chapter 8: Forge of the Fire Giants", "Ironslag", "combat", "Stop the fire giant duke's forge before the war engine is completed.", ["Destroy the forge", "Fight the duke", "Collapse the escape route"], ["fire_giant"]),
    ("ch09-lyn-armaal", "Chapter 9: Castle of the Cloud Giants", "Lyn Armaal", "exploration", "Board Lyn Armaal and uncover the cloud giant countess's scheme.", ["Find a landing point", "Explore the castle", "Question servants"], ["bandit", "cloud_giant"]),
    ("ch09-cloud-giant-showdown", "Chapter 9: Castle of the Cloud Giants", "Lyn Armaal", "combat", "Survive the cloud castle confrontation and secure its secret.", ["Duel the countess", "Use the castle controls", "Rescue captives"], ["cloud_giant"]),
    ("ch10-maelstrom-entry", "Chapter 10: Hold of the Storm Giants", "Maelstrom", "social", "Enter Maelstrom and navigate storm giant court politics.", ["Request audience", "Read the court", "Present evidence"], ["storm_giant"]),
    ("ch10-maelstrom-intrigue", "Chapter 10: Hold of the Storm Giants", "Maelstrom", "social", "Identify the traitor's influence and win allies among the storm giants.", ["Question the sisters", "Inspect clues", "Protect Serissa"], ["storm_giant"]),
    ("ch10-maelstrom-crisis", "Chapter 10: Hold of the Storm Giants", "Maelstrom", "combat", "Survive the crisis at Maelstrom and learn where the missing king may be.", ["Defend the throne", "Expose the deception", "Pursue the lead"], ["storm_giant"]),
    ("ch11-grand-dame", "Chapter 11: Caught in the Tentacles", "The Grand Dame", "social", "Investigate the gambling ship and expose the abductors' trail.", ["Play the tables", "Shadow a suspect", "Force a confession"], ["bandit", "bandit", "bugbear"]),
    ("ch11-morkoth", "Chapter 11: Caught in the Tentacles", "The Morkoth", "exploration", "Board the Morkoth and find the captive king before the enemy arrives.", ["Sneak aboard", "Search cabins", "Release prisoners"], ["bandit", "bugbear", "orc"]),
    ("ch11-kraken", "Chapter 11: Caught in the Tentacles", "The Kraken Cometh", "combat", "Escape the sea-borne catastrophe with the truth intact.", ["Cut prisoners free", "Hold the deck", "Flee the monster"], ["bugbear", "ogre"]),
    ("ch12-lair-approach", "Chapter 12: Doom of the Desert", "Iymrith's Lair", "exploration", "Reach the desert lair and prepare for the final confrontation.", ["Cross the dunes", "Find the entrance", "Set an ambush"], ["stone_giant", "storm_giant"]),
    ("ch12-final-battle", "Chapter 12: Doom of the Desert", "Iymrith's Lair", "combat", "Defeat the campaign villain with the storm giants' fate at stake.", ["Attack directly", "Exploit lair terrain", "Protect allies"], ["storm_giant"]),
    ("ch12-conclusion", "Chapter 12: Doom of the Desert", "Adventure Conclusion", "social", "Resolve the aftermath and decide the North's future.", ["Restore alliances", "Reward survivors", "Retire or continue"], ["storm_giant"]),
]


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def flatten_outline(reader: PdfReader) -> dict[str, int]:
    pages: dict[str, int] = {}

    def walk(items):
        for item in items:
            if isinstance(item, list):
                walk(item)
                continue
            title = getattr(item, "title", str(item))
            try:
                pages[title] = reader.get_destination_page_number(item) + 1
            except Exception:
                pass

    walk(reader.outline)
    return pages


def page_for(outline_pages: dict[str, int], chapter: str, location: str) -> int | None:
    return outline_pages.get(location) or outline_pages.get(chapter)


def build_module(pdf_path: Path) -> dict:
    reader = PdfReader(str(pdf_path))
    outline_pages = flatten_outline(reader)

    scenes = {}
    scene_order = []
    chapters: dict[str, dict] = {}
    scene_encounters = {}

    for scene_id, chapter_title, location, kind, goal, choices, templates in MILESTONES:
        scene_order.append(scene_id)
        page = page_for(outline_pages, chapter_title, location)
        reference = f"Local PDF reference: {location}, page {page}." if page else f"Local PDF reference: {location}."
        next_instruction = "Use advance_scene when the objective is complete, the party has chosen a direction, or the scene's key clue/reward has been established."
        scenes[scene_id] = {
            "kind": kind,
            "goal": goal,
            "starter": f"The party reaches {location}. The situation is tense, and giant-sized consequences are close at hand.",
            "choices": choices,
            "guidance": (
                f"{reference} Consult your owned book for room text, maps, named treasure, and exact special NPC details. "
                f"Run this scene from summarized facts only: establish the local threat, ask for rolls when risk matters, "
                f"log important discoveries as canon facts, and avoid inventing exact book-only text. {next_instruction}"
            ),
        }
        if kind == "combat":
            scene_encounters[scene_id] = {"templates": templates}
        elif templates and any(t.endswith("_giant") for t in templates):
            scene_encounters[scene_id] = {"auto": True, "difficulty": "hard", "preferredTemplates": templates}

        chapter_id = slug(chapter_title.split(":")[0])
        if chapter_id not in chapters:
            chapters[chapter_id] = {"id": chapter_id, "title": chapter_title, "sceneIds": []}
        chapters[chapter_id]["sceneIds"].append(scene_id)

    scene_order.append("ending")
    chapters.setdefault("ending", {"id": "ending", "title": "Campaign End", "sceneIds": []})["sceneIds"].append("ending")

    return {
        "id": "storm-kings-thunder",
        "title": "Storm King's Thunder - private local campaign",
        "tagline": "Local-only scaffold for your owned PDF: full campaign beats with page references and SRD-style mechanics.",
        "estimatedMinutes": 2400,
        "tone": "epic frontier giant crisis",
        "recommendedCharacters": ["fighter", "cleric", "rogue", "wizard"],
        "levelRange": [1, 10],
        "sourceNote": f"Private module generated from local outline of {pdf_path.name}; do not commit or redistribute.",
        "campaignGuide": (
            "Run this as a private companion to the owner's PDF. The module intentionally stores concise scene goals, "
            "page references, and mechanical scaffolding rather than adventure prose. Use the local book for read-aloud, "
            "maps, boxed text, exact treasure, and named room details. Keep continuity in the canon log. For solo play, "
            "scale fights down, allow allied NPC support, and prefer skill-driven solutions when a published encounter "
            "would overwhelm one character."
        ),
        "playConfig": {
            "defaultLevel": 1,
            "partySize": 1,
            "defaultDifficulty": "medium",
            "spawnMonstersOnCombatOnly": True,
            "preferredMonsterTemplates": ["goblin", "orc", "ogre", "hill_giant", "stone_giant", "frost_giant", "fire_giant", "cloud_giant", "storm_giant"],
        },
        "chapters": list(chapters.values()),
        "sceneOrder": scene_order,
        "scenes": scenes,
        "sceneEncounters": scene_encounters,
        "endingMessage": "The giant crisis is resolved. Record the final state of the North, surviving allies, and unresolved enemies in the canon log.",
        "npcs": [
            {
                "id": "campaign-guide",
                "name": "Campaign Guide",
                "description": "A private local reference marker for the owner's PDF and table notes.",
                "disposition": "friendly",
                "knowledge": [
                    "Use the local PDF page references for official maps, exact names, read-aloud, treasure, and room details.",
                    "The app owns dice, HP, scene state, and canon log continuity.",
                ],
            }
        ],
        "monsters": [
            {"id": "placeholder-1", "name": "Placeholder", "ac": 10, "maxHp": 1, "attackBonus": 0, "damage": "1"}
        ],
        "mock": {
            "socialNpcId": "campaign-guide",
            "socialNpcName": "the campaign guide",
            "socialSuccess": "The lead becomes clear. Record the useful fact, then continue when the party chooses a direction.",
            "socialFailure": "The answer is incomplete. Ask a sharper question, offer proof, or try a different approach.",
            "explorationSuccess": "The party finds the needed route, clue, or weakness. Add the discovery to the canon log.",
            "explorationFailure": "The trail is muddy or dangerous. Introduce a complication, then let the party try a new tactic.",
            "socialSkill": "persuasion",
            "explorationSkill": "investigation",
            "socialDc": 13,
            "explorationDc": 13,
            "canonFactOnSocialSuccess": "The party secured a campaign lead from the current scene.",
        },
    }


def main() -> int:
    pdf_path = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_PDF
    out_path = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else DEFAULT_OUT

    if not pdf_path.exists():
        print(f"PDF not found: {pdf_path}", file=sys.stderr)
        return 1

    module = build_module(pdf_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(module, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {out_path}")
    print(f"Scenes: {len(module['sceneOrder']) - 1} playable + ending")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
