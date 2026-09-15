import Link from 'next/link';

const CURRENT_RULES_URL = 'https://www.dndbeyond.com/sources/dnd/br-2024/character-classes';
const CURRENT_FEATS_URL = 'https://www.dndbeyond.com/sources/dnd/br-2024/feats';
const CURRENT_SPELLS_URL = 'https://www.dndbeyond.com/sources/dnd/br-2024/spell-descriptions';
const LEGACY_RULES_URL = 'https://www.dndbeyond.com/sources/dnd/basic-rules-2014/classes';

function EditionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
      {children}
    </span>
  );
}

function Rule({ title, edition, children }: { title: string; edition: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{title}</h3>
        <EditionBadge>{edition}</EditionBadge>
      </div>
      <div className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{children}</div>
    </div>
  );
}

export default function RulesReferencePage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">PartyQuest knowledge base</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">D&amp;D Rules &amp; Character Vault</h1>
        </div>
        <Link className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700" href="/">
          Back to AI Dungeon Master
        </Link>
      </div>

      <p className="mt-5 max-w-3xl text-zinc-600 dark:text-zinc-400">
        Table-ready notes consolidated from Josh&apos;s D&amp;D chats and campaign records. Every rule is tagged by ruleset so legacy 2014 5e and the current 2024 rules used in 2026 (now labelled 5.5e on D&amp;D Beyond) are not silently mixed.
      </p>

      <section className="mt-10 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <h2 className="text-lg font-semibold">Ruleset switch matters</h2>
        <p className="mt-2 text-sm leading-6">
          The Chronos Fracture and the recovered Storm King&apos;s Thunder material use strict 2014 5e. Several quick rulings from September 2026 explicitly switched to the current 5.5e rules. When a campaign sheet says 2014, use the legacy ruling even if a current-rule answer appears elsewhere on this page.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <a className="rounded-lg border border-amber-400 px-3 py-2 underline-offset-2 hover:underline dark:border-amber-800" href={LEGACY_RULES_URL} target="_blank" rel="noreferrer">2014 Basic Rules</a>
          <a className="rounded-lg border border-amber-400 px-3 py-2 underline-offset-2 hover:underline dark:border-amber-800" href={CURRENT_RULES_URL} target="_blank" rel="noreferrer">Current class rules</a>
          <a className="rounded-lg border border-amber-400 px-3 py-2 underline-offset-2 hover:underline dark:border-amber-800" href={CURRENT_FEATS_URL} target="_blank" rel="noreferrer">Current feats</a>
          <a className="rounded-lg border border-amber-400 px-3 py-2 underline-offset-2 hover:underline dark:border-amber-800" href={CURRENT_SPELLS_URL} target="_blank" rel="noreferrer">Current spells</a>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold">Fast table rulings</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Rule title="Attack roll equals AC" edition="2014 + current">
            A total attack roll equal to the target&apos;s Armor Class hits. AC 12 vs attack total 12 = hit.
          </Rule>
          <Rule title="Alert" edition="Current 5.5e">
            Alert does not mean roll Initiative twice. Add your Proficiency Bonus to Initiative, then you may swap your Initiative result with one willing ally in that combat if neither of you is Incapacitated.
          </Rule>
          <Rule title="Alert" edition="Legacy 2014">
            Legacy Alert gives +5 to Initiative, prevents surprise while conscious, and removes the normal unseen-attacker advantage against you. Do not use the current Initiative Swap wording in a strict-2014 campaign.
          </Rule>
          <Rule title="Knock and hidden locks" edition="2014 + current">
            Knock targets the visible object being secured; the locking mechanism itself does not need to be visible. It affects one lock/bolt-style obstruction at a time and produces a loud knock audible up to 300 feet.
          </Rule>
          <Rule title="Sorcery Points after a Short Rest" edition="Current 5.5e">
            A level-6 Sorcerer has Sorcerous Restoration: after a Short Rest, regain up to 3 expended Sorcery Points. Once used, it cannot be used again until after a Long Rest.
          </Rule>
          <Rule title="Sorcery Points after a Short Rest" edition="Legacy 2014">
            A level-6 Sorcerer does not normally regain Sorcery Points on a Short Rest. Legacy Font of Magic restores spent Sorcery Points on a Long Rest; legacy Sorcerous Restoration is a level-20 feature.
          </Rule>
          <Rule title="Dwarf poison defence" edition="Current 5.5e">
            Dwarven Resilience gives Resistance to Poison damage and Advantage on saves made to avoid or end the Poisoned condition.
          </Rule>
          <Rule title="Transmuted Spell" edition="Current / Tasha-compatible">
            Transmuted Spell can switch among acid, cold, fire, lightning, poison, and thunder. Radiant is not one of its damage-type choices.
          </Rule>
        </div>
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Character spotlight</p>
            <h2 className="text-3xl font-bold">Bram Oakmoss</h2>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">Firbolg · Druid 6 · Circle of Spores</p>
          </div>
          <EditionBadge>Recovered sheet: 2014-era / legacy subclass</EditionBadge>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"><div className="text-xs uppercase text-zinc-500">AC</div><div className="mt-1 text-2xl font-bold">16</div></div>
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"><div className="text-xs uppercase text-zinc-500">HP</div><div className="mt-1 text-2xl font-bold">45</div></div>
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"><div className="text-xs uppercase text-zinc-500">Spell save DC</div><div className="mt-1 text-2xl font-bold">14</div></div>
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"><div className="text-xs uppercase text-zinc-500">Spell attack</div><div className="mt-1 text-2xl font-bold">+6</div></div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <h3 className="font-semibold">Circle of Spores quick card</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              <li><strong>Halo of Spores:</strong> reaction-based necrotic damage to a nearby creature; Bram&apos;s recovered level-6 sheet records 1d6 with Constitution save DC 14.</li>
              <li><strong>Symbiotic Entity:</strong> spend a Wild Shape use without becoming a Beast; Bram&apos;s recovered sheet records 24 temporary HP at level 6 and enhanced spore/melee pressure while active.</li>
              <li><strong>Fungal Infestation:</strong> Bram has the level-6 feature that can animate a recently fallen nearby Small/Medium Beast or Humanoid as a zombie, within the feature&apos;s use limits.</li>
              <li><strong>Spreading Spores:</strong> not a level-6 feature; it arrives later in the legacy Circle of Spores progression.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <h3 className="font-semibold">Bram&apos;s useful spells and kit</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Recovered notes include Thorn Whip, Produce Flame, Goodberry, Faerie Fire, Spike Growth, Gaseous Form, Protection from Energy, a wooden shield, non-metal hide armor, scimitar, quarterstaff/focus, healing potions, antitoxin, alchemist&apos;s fire, grappling hook, silk rope, crowbar, pitons and healer&apos;s kit. A Cloak of Displacement was recorded as pending DM approval.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold">Bram: Wild Shape</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Rule title="Strict 2014 Bram" edition="Legacy 2014">
            At Druid 6, a non-Moon Druid can use a Beast form Bram has seen, up to CR 1/2. Swimming forms are allowed; forms with a flying speed are not available until level 8. Wild Shape has two uses, recovered on a Short or Long Rest.
          </Rule>
          <Rule title="If the table uses current Wild Shape" edition="Current 5.5e">
            At Druid 6, the Druid knows six chosen Beast forms, each up to CR 1/2 and without a Fly Speed. This is not an unlimited “any Beast you have seen” list. One known form can be replaced after a Long Rest. Wild Shape has two uses; a Short Rest restores one use and a Long Rest restores all uses.
          </Rule>
        </div>

        <div className="mt-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h3 className="font-semibold">Strong level-6 candidates</h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Subject to the chosen ruleset, source availability, DM permission and (for 2014) having seen the Beast.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            {[
              ['Black Bear', 'general melee / multiattack'],
              ['Ape', 'climbing and a ranged rock attack'],
              ['Crocodile', 'swimming and control'],
              ['Warhorse', 'fast transport'],
              ['Giant Goat', 'speed and charge'],
              ['Reef Shark', 'underwater combat'],
              ['Giant Badger', 'burrowing utility'],
              ['Giant Wolf Spider', 'climbing and scouting'],
              ['Spider', 'Tiny infiltration and wall climbing'],
            ].map(([name, use]) => (
              <div key={name} className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900"><strong>{name}</strong><div className="mt-1 text-zinc-500">{use}</div></div>
            ))}
          </div>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Tiny is the smallest standard size category used for these forms. A spider is a strong infiltration choice, but whether a particular gap or keyhole is physically passable remains a DM call.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold">Familiars, flight and radiant damage</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Rule title="Wild Companion / Find Familiar" edition="Current 5.5e">
            A Druid can spend a spell slot or Wild Shape use to cast Find Familiar without Material components; that familiar is Fey and lasts until the Druid finishes a Long Rest. Standard familiar choices include Bat, Cat, Frog, Hawk, Lizard, Octopus, Owl, Rat, Raven, Spider and Weasel, with other CR 0 Beasts subject to the spell/DM.
          </Rule>
          <Rule title="Can Bram fly?" edition="Druid 6">
            Not through base Wild Shape at level 6. Flying Beast forms unlock at Druid level 8. A familiar such as an Owl, Hawk, Bat or Raven can fly, but it does not carry the Druid as a substitute for personal flight.
          </Rule>
          <Rule title="Will-o’-Wisp" edition="Tactical note">
            A Beast form is usually a poor damage answer: the creature flies and is difficult for level-6 non-flying forms to reach, while its defences blunt common Beast attack damage. Moonbeam is the better Bram tool when radiant damage is needed, and Wild Shape does not end concentration on a spell already cast.
          </Rule>
          <Rule title="Call Lightning warning" edition="Tactical note">
            Do not pick Call Lightning specifically to solve a Will-o’-Wisp fight: the stat block used for this ruling is immune to Lightning. Moonbeam is the cleaner radiant option.
          </Rule>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold">Level-6 Sorcerer quick reference</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Rule title="Rare item shortlist" edition="DM/source dependent">
            Strong rare options discussed: Bloodwell Vial +2 for Sorcerer spellcasting and Sorcery Point recovery interaction, Wand of Fireballs for burst offence, Ring of Spell Storing for flexibility, Wand of the War Mage +2 for spell attacks, Astral Shard for Metamagic mobility, and Sun Blade when a radiant weapon is useful.
          </Rule>
          <Rule title="Radiant damage" edition="Current 5.5e">
            True Strike can make its weapon attack deal Radiant damage and scales with character level. Magic Initiate (Cleric) can provide Guiding Bolt. A Ring of Spell Storing can also carry a suitable radiant spell loaded by another caster. Legacy Divine Soul is another route only if the table allows that older subclass with the current rules.
          </Rule>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold">Recovered character archive</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr><th className="p-3">Character</th><th className="p-3">Build</th><th className="p-3">Recovered notes</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              <tr><td className="p-3 font-medium">Bram Oakmoss</td><td className="p-3">Firbolg Druid 6 · Circle of Spores</td><td className="p-3">AC 16, HP 45, spell DC 14, spell attack +6.</td></tr>
              <tr><td className="p-3 font-medium">Alphie J. Roane</td><td className="p-3">Human Noble Wizard · 2014</td><td className="p-3">AC 12 / 15 with Mage Armor, HP 8, spell DC 13, attack +5; Fire Bolt, Mage Hand, Prestidigitation; Mage Armor, Shield, Sleep, Magic Missile. Raven familiar concept: Ink.</td></tr>
              <tr><td className="p-3 font-medium">Wren</td><td className="p-3">Half-Elf Entertainer Bard · 2014</td><td className="p-3">AC 13, HP 10, CHA 17, spell DC 13; Bardic Inspiration d6; Sleep, Healing Word, Faerie Fire, Dissonant Whispers, Vicious Mockery, Minor Illusion.</td></tr>
              <tr><td className="p-3 font-medium">Dorrin Stonebrook</td><td className="p-3">Hill Dwarf Life Cleric · 2014</td><td className="p-3">Recovered early-campaign sheet: AC 18, HP 12.</td></tr>
              <tr><td className="p-3 font-medium">Sir Robert-Morgan the 4th</td><td className="p-3">Human Paladin 4 · Oath of the Watchers</td><td className="p-3">Pets of the Spider Queen one-shot; starts imprisoned without normal gear.</td></tr>
              <tr><td className="p-3 font-medium">Katmur</td><td className="p-3">Halfling Rogue · Thief</td><td className="p-3">Pets of the Spider Queen roster.</td></tr>
              <tr><td className="p-3 font-medium">Tyrion Lifesoul</td><td className="p-3">Elf Cleric · Life Domain</td><td className="p-3">Pets of the Spider Queen roster.</td></tr>
              <tr><td className="p-3 font-medium">Darius</td><td className="p-3">Fighter · Psi Warrior</td><td className="p-3">Pets of the Spider Queen roster; species/race was not final in the recovered notes.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold">Campaign rules &amp; continuity</h2>
        <div className="mt-4 space-y-4">
          <details open className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <summary className="cursor-pointer font-semibold">The Chronos Fracture</summary>
            <div className="mt-3 space-y-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              <p>Strict D&amp;D 5e 2014 baseline. Fixed HP, point buy, milestone advancement, scene-bound timeline shifts, no random “gotcha” swaps, and consent-based PvP/mind control.</p>
              <p>The central premise is a sick Chronos and unstable timelines: PCs can alternate between level-5 selves and level-17 possible futures. Those futures are possibilities, not guaranteed destiny. The tone is dark planar fantasy with hope, identity, consequences and planar wonder.</p>
              <p>2014 PHB/DMG/MM are the baseline sources, with character-required material from later books used only where established. Do not silently convert character sheets to current rules mid-campaign.</p>
            </div>
          </details>
          <details className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <summary className="cursor-pointer font-semibold">Storm King&apos;s Thunder / Alfie campaign</summary>
            <div className="mt-3 space-y-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              <p>Strict 2014 5e with milestone advancement. Recovered core party: Alphie J. Roane, Wren and Dorrin Stonebrook. Kella is a disarmed, self-interested Zhentarim ally in the recovered Nightstone continuity.</p>
              <p>Continuity records distinguish source-canon campaign state from simulated-table and homebrew/possible-future layers; do not merge those layers automatically.</p>
            </div>
          </details>
          <details className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <summary className="cursor-pointer font-semibold">Pets of the Spider Queen</summary>
            <div className="mt-3 space-y-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              <p>Level-4 prisoner one-shot. Characters begin without their normal gear beyond clothes and a very small number of personal items, with scavenging/crafting part of play. Character hooks include why the Spider Queen noticed them, why they have not escaped, and a reason they will cooperate.</p>
            </div>
          </details>
        </div>
      </section>

      <section className="mt-12 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-xl font-bold">Related D&amp;D apps</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Use this page as the rules/character index; use the specialised apps for play, campaign tracking and world reference.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <a className="rounded-lg bg-zinc-50 p-3 hover:underline dark:bg-zinc-900" href="https://ai-dungeon-master-azure.vercel.app/">AI Dungeon Master</a>
          <a className="rounded-lg bg-zinc-50 p-3 hover:underline dark:bg-zinc-900" href="https://joshuaparris-max.github.io/campaign-copilot/">Campaign Copilot</a>
          <a className="rounded-lg bg-zinc-50 p-3 hover:underline dark:bg-zinc-900" href="https://3layers-puce.vercel.app/">3layers / Alfie</a>
          <a className="rounded-lg bg-zinc-50 p-3 hover:underline dark:bg-zinc-900" href="https://sword-coast.vercel.app/">Sword Coast</a>
          <a className="rounded-lg bg-zinc-50 p-3 hover:underline dark:bg-zinc-900" href="https://realms-bay.vercel.app/">Eleven Realms</a>
          <a className="rounded-lg bg-zinc-50 p-3 hover:underline dark:bg-zinc-900" href="https://joshuaparris-max.github.io/realms-atlas/">Realms Atlas</a>
        </div>
      </section>

      <footer className="mt-12 border-t border-zinc-200 pt-6 text-xs leading-5 text-zinc-500 dark:border-zinc-800">
        This vault intentionally stores concise, table-ready summaries rather than copied sourcebook text. Sourcebook wording and your active character sheet remain authoritative when a summary conflicts with them. Last consolidated: 15 September 2026.
      </footer>
    </main>
  );
}
