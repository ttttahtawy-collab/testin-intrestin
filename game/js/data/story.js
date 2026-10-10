// Story: speakers and cutscene scripts. A cutscene is a list of shots; each
// shot sets a backdrop + actors and plays dialogue lines.
(function (G) {
  'use strict';
  const S = (G.Story = {});

  S.speakers = {
    ember: { name: 'Ember', color: '#ff7563', bg: '#3b1b26' },
    lumi: { name: 'Lumi', color: '#8fe3ff', bg: '#1d2d52' },
    king: { name: 'King Monochrome', color: '#e2dfeb', bg: '#26242e' },
    glumbo: { name: 'Glumbo', color: '#e0c66a', bg: '#2d2b3a' },
    golem: { name: 'Quartzard', color: '#c8a8ff', bg: '#241c40' },
    hawk: { name: 'Galewing', color: '#dfe6ff', bg: '#26304f' },
    narrator: { name: '', color: '#ffd38a' },
  };

  // actors: {id, x (0..1 of screen width), facing, grey}
  S.scripts = {
    intro: {
      music: 'story',
      shots: [
        {
          bg: 'meadow', actors: [{ id: 'ember', x: 0.5, facing: 1 }],
          lines: [
            { text: 'Long ago, the land of Prismara shone with every colour imaginable — all of it flowing from the great Prism Heart.' },
            { text: 'And the brightest little spark in all the land was a cheerful red hero named Ember.' },
          ],
        },
        {
          bg: 'citadel', actors: [{ id: 'king', x: 0.5, facing: -1 }],
          lines: [
            { text: 'But in the Grey Citadel, a jealous ruler had grown tired of all that colour...' },
            { who: 'king', text: 'Colour is NOISE. Colour is CHAOS. Colour makes everyone so... HAPPY.' },
            { who: 'king', text: 'I shall shatter the Prism Heart, and from this day forth, the world will be GREY!' },
          ],
        },
        {
          bg: 'meadow', grey: true, actors: [{ id: 'ember', x: 0.38, facing: 1 }, { id: 'lumi', x: 0.62, facing: -1 }],
          lines: [
            { text: 'With a terrible CRACK, the Prism Heart burst into shards that rained across the land. The colour drained away...' },
            { who: 'ember', text: 'Huh?! Where did all the colours go? The grass... the sky... everything is grey!' },
            { who: 'lumi', text: "Ember! You're still red! The King's spell couldn't drain you!" },
            { who: 'lumi', text: "I'm Lumi, a spirit of the Prism Heart. If we gather its shards and beat the King's Gloom minions, colour will come back!" },
            { who: 'ember', text: 'Then what are we waiting for? Nobody turns MY world grey!' },
            { who: 'lumi', text: "Look for me along the way — I'll leave you tips. And collect gems! I know a shop that sells upgrades." },
          ],
        },
      ],
    },
    world2: {
      music: 'story',
      shots: [
        {
          bg: 'meadow', actors: [{ id: 'ember', x: 0.4, facing: 1 }, { id: 'lumi', x: 0.6, facing: -1 }],
          lines: [
            { who: 'lumi', text: 'Look, Ember! The meadow is blooming again!' },
            { who: 'ember', text: "Glumbo won't be squashing anybody for a while. Where to next?" },
            { who: 'lumi', text: 'The next shards fell deep into the Crystal Caverns. Watch out — the floors there crumble!' },
          ],
        },
        {
          bg: 'caves', grey: true, actors: [{ id: 'king', x: 0.5, facing: -1 }],
          lines: [
            { who: 'king', text: 'A red speck is undoing my beautiful grey? How tiresome.' },
            { who: 'king', text: 'Quartzard! Guard the shards. Crush that little spark into dust.' },
          ],
        },
      ],
    },
    world3: {
      music: 'story',
      shots: [
        {
          bg: 'caves', actors: [{ id: 'ember', x: 0.4, facing: 1 }, { id: 'lumi', x: 0.6, facing: -1 }],
          lines: [
            { who: 'lumi', text: "Quartzard's crystal core is glowing... it's resonating with you!" },
            { who: 'ember', text: 'Whoa! I feel... ZOOMY!' },
            { who: 'lumi', text: 'You learned to DASH! Press C, Shift or L (or the DASH button) — even in mid-air!' },
            { who: 'lumi', text: 'Next stop: Frostwind Peaks. The storm hawk Galewing rules the skies up there.' },
          ],
        },
      ],
    },
    world4: {
      music: 'story',
      shots: [
        {
          bg: 'peaks', actors: [{ id: 'ember', x: 0.4, facing: 1 }, { id: 'lumi', x: 0.6, facing: -1 }],
          lines: [
            { who: 'ember', text: "Galewing's down! The sky is pink and blue again!" },
            { who: 'lumi', text: 'Only one place left... the Grey Citadel. The King is waiting.' },
          ],
        },
        {
          bg: 'citadel', actors: [{ id: 'king', x: 0.5, facing: -1 }],
          lines: [
            { who: 'king', text: 'So. The little spark has come all this way.' },
            { who: 'king', text: 'Come to my citadel, then. Climb my halls of ash and lava... and watch your colour fade forever.' },
          ],
        },
      ],
    },
    ending: {
      music: 'ending',
      shots: [
        {
          bg: 'citadel', actors: [{ id: 'ember', x: 0.35, facing: 1 }, { id: 'king', x: 0.65, facing: -1 }],
          lines: [
            { who: 'king', text: 'Impossible... the colours... they are so... warm.' },
            { who: 'ember', text: "Hey, King. You know grey is a colour too, right? There's room for everyone." },
            { who: 'king', text: '...Perhaps. Perhaps I could try... a little blue.' },
          ],
        },
        {
          bg: 'meadow', actors: [{ id: 'ember', x: 0.4, facing: 1 }, { id: 'lumi', x: 0.6, facing: -1 }],
          lines: [
            { who: 'lumi', text: 'The Prism Heart is whole again! Colour is flowing all across Prismara!' },
            { who: 'ember', text: 'We did it, Lumi! Every flower, every crystal, every sunset — back where they belong!' },
            { key: 'allShards', text: 'With every single Prism Shard recovered, the Heart now shines brighter than ever before. Prismara has never looked so beautiful.' },
            { key: 'notAllShards', text: 'A few Prism Shards are still hidden out there... Can you find them all and make the Heart shine at full brightness?' },
            { text: 'THE END' },
          ],
        },
      ],
    },
  };
})(window.G);
