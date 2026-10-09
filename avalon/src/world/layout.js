// Hand-authored macro layout of the isle of Avalon (voxel coordinates, north = -z).

export const REGIONS = {
  greywater: { name: 'Greywater Hollow', x: 620, z: 1500, r: 230 },
  weald: { name: 'The Rowan Weald', x: 500, z: 1000, r: 330 },
  kingsfall: { name: 'Kingsfall', x: 1000, z: 760, r: 200 },
  moor: { name: 'The Heather Moor', x: 1030, z: 1080, r: 220 },
  caerdawn: { name: 'Caer Dawn', x: 1480, z: 640, r: 230 },
  mirefen: { name: 'The Mirefen', x: 1520, z: 1360, r: 300 },
  highcrag: { name: 'Highcrag', x: 980, z: 260, r: 380 },
  coast: { name: 'Saltby Shore', x: 1060, z: 1800, r: 260 },
};

export const SETTLE = {
  greywater: { x: 610, z: 1500, r: 70, y: 44 },
  quarantine: { x: 500, z: 1590, r: 34, y: 42 },
  lodge: { x: 420, z: 1060, r: 26, y: 0 },
  banditCamp: { x: 680, z: 860, r: 34, y: 0 },
  kingsfall: { x: 1000, z: 730, r: 60, y: 0 },
  caerdawn: { x: 1490, z: 640, r: 125, y: 60 },
  stillwater: { x: 1370, z: 1260, r: 50, y: 0 },
  saltby: { x: 1010, z: 1795, r: 50, y: 34 },
  lighthouse: { x: 1250, z: 1880, r: 14, y: 0 },
  mine: { x: 1190, z: 380, r: 20, y: 0 },
  crossroads: { x: 830, z: 1160, r: 16, y: 0 },
  mireHeart: { x: 1680, z: 1470, r: 40, y: 0 },
  watchtower: { x: 760, z: 1260, r: 12, y: 0 },
  farmstead: { x: 820, z: 1520, r: 30, y: 0 },
  sunMeadow: { x: 880, z: 190, r: 30, y: 0 },
  bearDen: { x: 760, z: 330, r: 20, y: 0 },
  hollowCave: { x: 330, z: 880, r: 12, y: 0 },
  wreck: { x: 840, z: 1915, r: 20, y: 0 },
  deserterCamp: { x: 1250, z: 980, r: 26, y: 0 },
  elderBloom: { x: 930, z: 1300, r: 14, y: 0 },
};

export const LAKES = [
  { x: 770, z: 1430, rx: 70, rz: 50, level: 40 },
  { x: 380, z: 1250, rx: 45, rz: 35, level: 42 },
  { x: 1600, z: 1230, rx: 60, rz: 45, level: 32 },
];

export const RIVERS = [
  { w: 7, pts: [[1080, 250], [1100, 420], [1110, 560], [1170, 760], [1200, 920], [1160, 1080], [1150, 1260], [1110, 1450], [1090, 1640], [1070, 1760], [1060, 1990]] },
  { w: 5, pts: [[1350, 330], [1380, 470], [1400, 560], [1380, 640], [1400, 760], [1560, 820], [1760, 880], [2000, 900]] },
];

export const ROADS = [
  { name: 'Kingsway', pts: [[610, 1470], [650, 1380], [720, 1300], [780, 1230], [830, 1160], [880, 1060], [930, 960], [980, 880], [1000, 800]] },
  { name: 'East Road', pts: [[830, 1160], [950, 1130], [1060, 1110], [1160, 1090], [1260, 1000], [1340, 880], [1420, 790], [1490, 750]] },
  { name: 'Coast Road', pts: [[620, 1540], [700, 1620], [820, 1700], [940, 1760], [1010, 1790]] },
  { name: 'Fen Road', pts: [[1010, 1790], [1100, 1740], [1200, 1640], [1290, 1500], [1350, 1380], [1370, 1290]] },
  { name: 'Marsh Track', pts: [[1370, 1250], [1420, 1120], [1450, 980], [1470, 850], [1490, 760]] },
  { name: 'Mountain Road', pts: [[1385, 620], [1370, 540], [1340, 470], [1300, 430], [1230, 395], [1190, 385]] },
  { name: 'High Pass', pts: [[1190, 385], [1110, 330], [1010, 280], [920, 230], [880, 200]] },
  { name: 'Weald Path', pts: [[830, 1160], [720, 1110], [600, 1080], [480, 1070], [430, 1065]] },
  { name: 'Hollow Trail', pts: [[600, 1080], [640, 980], [670, 900]] },
  { name: 'Farm Lane', pts: [[640, 1500], [720, 1510], [800, 1520]] },
  { name: 'Lighthouse Path', pts: [[1010, 1790], [1120, 1830], [1240, 1870]] },
  { name: 'Den Trail', pts: [[1010, 280], [900, 310], [780, 330]] },
  { name: 'Deserter Track', pts: [[1160, 1090], [1210, 1030], [1250, 990]] },
];

// Points of interest for the map / compass discovery
export const POIS = [
  { id: 'greywater', name: 'Greywater Hollow', x: 610, z: 1500, type: 'village' },
  { id: 'quarantine', name: 'The Sick-Tents', x: 500, z: 1590, type: 'camp' },
  { id: 'lodge', name: "Hunter's Lodge", x: 420, z: 1060, type: 'house' },
  { id: 'banditCamp', name: "Osric's Hollow", x: 680, z: 860, type: 'danger' },
  { id: 'kingsfall', name: 'Kingsfall Ruins', x: 1000, z: 730, type: 'ruin' },
  { id: 'caerdawn', name: 'Caer Dawn', x: 1490, z: 640, type: 'castle' },
  { id: 'stillwater', name: 'Stillwater', x: 1370, z: 1260, type: 'village' },
  { id: 'saltby', name: 'Saltby', x: 1010, z: 1795, type: 'village' },
  { id: 'lighthouse', name: 'Gull Point Light', x: 1250, z: 1880, type: 'tower' },
  { id: 'mine', name: 'Ironhollow Mine', x: 1190, z: 380, type: 'cave' },
  { id: 'crossroads', name: 'Crow\'s Crossroads', x: 830, z: 1160, type: 'camp' },
  { id: 'mireHeart', name: 'Heart of the Mire', x: 1680, z: 1470, type: 'danger' },
  { id: 'watchtower', name: 'Old Watchtower', x: 760, z: 1260, type: 'tower' },
  { id: 'farmstead', name: 'Brannoc Farm', x: 820, z: 1520, type: 'house' },
  { id: 'sunMeadow', name: 'Sunpetal Meadow', x: 880, z: 190, type: 'secret' },
  { id: 'bearDen', name: "Grimtooth's Den", x: 760, z: 330, type: 'danger' },
  { id: 'hollowCave', name: 'Hollow Oak Cave', x: 330, z: 880, type: 'cave' },
  { id: 'wreck', name: 'Wreck of the Merrow', x: 840, z: 1915, type: 'secret' },
  { id: 'deserterCamp', name: 'Deserters\' Camp', x: 1250, z: 980, type: 'danger' },
  { id: 'elderBloom', name: 'The Elder Bloom', x: 930, z: 1300, type: 'landmark' },
];
