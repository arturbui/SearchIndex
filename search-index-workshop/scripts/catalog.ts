// Domain vocabulary for a Knuspr-style online grocery store.
// Curated by hand so generated products read like a real supermarket catalog
// (German category names, real-sounding brands, sensible units & price ranges).

export interface Archetype {
  base: string;            // core product noun, e.g. "Hafermilch"
  units: string[];         // plausible pack sizes
  priceRange: [number, number]; // euros, min..max
  descParts: string[];     // adjectives/claims used to build a description
  tags: string[];
}

export interface CategoryDef {
  category: string;
  subcategory: string;
  brands: string[];
  archetypes: Archetype[];
}

// Adjectives that get mixed into product names (some German, some marketing-y).
export const NAME_PREFIXES = [
  "", "", "", "Bio", "Bio", "Frische", "Premium", "Regionale", "Hofgut",
  "Klassische", "Feinste", "Original", "Hausgemachte",
];

export const BIO_BRANDS = ["dmBio", "Alnatura", "demeter", "Bioland", "Knuspr Bio"];

export const CATALOG: CategoryDef[] = [
  {
    category: "Obst & Gemüse",
    subcategory: "Obst",
    brands: ["Knuspr", "Regional", "Edeka Bio", "Alnatura"],
    archetypes: [
      { base: "Äpfel Elstar", units: ["1 kg", "2 kg", "750 g"], priceRange: [1.9, 4.5], descParts: ["knackig", "süß-säuerlich", "aus regionalem Anbau"], tags: ["obst", "vegan", "regional"] },
      { base: "Bananen", units: ["1 kg", "5 Stück"], priceRange: [1.2, 2.8], descParts: ["fair gehandelt", "vollreif", "aus Ecuador"], tags: ["obst", "vegan", "fairtrade"] },
      { base: "Erdbeeren", units: ["500 g", "250 g"], priceRange: [2.5, 5.9], descParts: ["sonnengereift", "aromatisch", "saisonal"], tags: ["obst", "vegan", "saisonal"] },
      { base: "Bio-Zitronen", units: ["500 g", "4 Stück"], priceRange: [1.8, 3.4], descParts: ["unbehandelte Schale", "spritzig"], tags: ["obst", "bio", "vegan"] },
      { base: "Heidelbeeren", units: ["125 g", "250 g"], priceRange: [2.2, 4.8], descParts: ["antioxidantienreich", "handverlesen"], tags: ["obst", "vegan", "superfood"] },
    ],
  },
  {
    category: "Obst & Gemüse",
    subcategory: "Gemüse",
    brands: ["Knuspr", "Regional", "demeter", "Bioland"],
    archetypes: [
      { base: "Tomaten Rispe", units: ["500 g", "1 kg"], priceRange: [1.8, 3.9], descParts: ["am Strauch gereift", "aromatisch"], tags: ["gemüse", "vegan"] },
      { base: "Karotten", units: ["1 kg", "500 g", "2 kg"], priceRange: [0.9, 2.4], descParts: ["knackig", "vitaminreich", "regional"], tags: ["gemüse", "vegan", "regional"] },
      { base: "Avocado", units: ["2 Stück", "1 Stück"], priceRange: [1.5, 3.9], descParts: ["genussreif", "cremig"], tags: ["gemüse", "vegan"] },
      { base: "Bio-Kartoffeln festkochend", units: ["1.5 kg", "2.5 kg"], priceRange: [1.6, 3.8], descParts: ["festkochend", "aus Deutschland"], tags: ["gemüse", "bio", "vegan"] },
      { base: "Babyspinat", units: ["200 g", "125 g"], priceRange: [1.4, 2.9], descParts: ["zart", "gewaschen", "verzehrfertig"], tags: ["gemüse", "vegan"] },
    ],
  },
  {
    category: "Milchprodukte & Eier",
    subcategory: "Milch & Drinks",
    brands: ["Weihenstephan", "Berchtesgadener Land", "Landliebe", "Oatly", "Alpro", "dmBio"],
    archetypes: [
      { base: "Frische Vollmilch 3,5%", units: ["1 L"], priceRange: [1.0, 1.8], descParts: ["aus Weidehaltung", "länger frisch"], tags: ["milch", "kühlware"] },
      { base: "Haferdrink Barista", units: ["1 L"], priceRange: [1.6, 2.9], descParts: ["aufschäumbar", "pflanzlich", "ohne Zuckerzusatz"], tags: ["milchalternative", "vegan"] },
      { base: "Mandeldrink ungesüßt", units: ["1 L"], priceRange: [1.7, 3.2], descParts: ["pflanzlich", "kalorienarm"], tags: ["milchalternative", "vegan"] },
      { base: "Laktosefreie Milch", units: ["1 L"], priceRange: [1.3, 2.2], descParts: ["bekömmlich", "laktosefrei"], tags: ["milch", "laktosefrei"] },
    ],
  },
  {
    category: "Milchprodukte & Eier",
    subcategory: "Joghurt & Quark",
    brands: ["Ehrmann", "Danone", "Landliebe", "Andechser", "dmBio"],
    archetypes: [
      { base: "Naturjoghurt 3,8%", units: ["500 g", "1 kg"], priceRange: [0.9, 2.4], descParts: ["cremig", "mild"], tags: ["joghurt", "kühlware"] },
      { base: "Griechischer Joghurt", units: ["400 g", "1 kg"], priceRange: [1.4, 3.2], descParts: ["proteinreich", "extra cremig"], tags: ["joghurt", "protein"] },
      { base: "Skyr Vanille", units: ["450 g", "150 g"], priceRange: [1.0, 2.6], descParts: ["fettarm", "proteinreich", "isländische Art"], tags: ["joghurt", "protein"] },
      { base: "Magerquark", units: ["500 g", "250 g"], priceRange: [0.8, 1.9], descParts: ["proteinreich", "fettarm"], tags: ["quark", "protein"] },
    ],
  },
  {
    category: "Milchprodukte & Eier",
    subcategory: "Käse",
    brands: ["Bergader", "Président", "Gouda Holland", "Hochland", "Galbani"],
    archetypes: [
      { base: "Gouda jung am Stück", units: ["300 g", "500 g"], priceRange: [2.2, 5.9], descParts: ["mild", "schnittfest"], tags: ["käse", "kühlware"] },
      { base: "Mozzarella", units: ["125 g", "2 x 125 g"], priceRange: [0.8, 2.4], descParts: ["für Salat & Pizza", "in Lake"], tags: ["käse", "vegetarisch"] },
      { base: "Bergkäse gereift", units: ["200 g", "400 g"], priceRange: [3.5, 7.9], descParts: ["würzig", "12 Monate gereift"], tags: ["käse"] },
      { base: "Feta", units: ["200 g"], priceRange: [1.6, 3.4], descParts: ["aus Schafsmilch", "kräftig"], tags: ["käse"] },
    ],
  },
  {
    category: "Brot & Backwaren",
    subcategory: "Brot",
    brands: ["Harry", "Mestemacher", "Knuspr Bäckerei", "Bauck Hof"],
    archetypes: [
      { base: "Roggenmischbrot", units: ["750 g", "500 g"], priceRange: [1.4, 3.2], descParts: ["saftig", "im Steinofen gebacken"], tags: ["brot"] },
      { base: "Vollkorn-Toast", units: ["500 g"], priceRange: [1.1, 2.4], descParts: ["ballaststoffreich", "ohne Konservierungsstoffe"], tags: ["brot"] },
      { base: "Dinkel-Sauerteigbrot", units: ["750 g"], priceRange: [2.2, 4.5], descParts: ["lange Teigführung", "kräftig"], tags: ["brot"] },
      { base: "Glutenfreies Mehrkornbrot", units: ["400 g"], priceRange: [2.8, 4.9], descParts: ["glutenfrei", "saftig"], tags: ["brot", "glutenfrei"] },
    ],
  },
  {
    category: "Getränke",
    subcategory: "Wasser & Softdrinks",
    brands: ["Gerolsteiner", "Coca-Cola", "Fritz-Kola", "Adelholzener", "Volvic"],
    archetypes: [
      { base: "Mineralwasser Classic", units: ["6 x 1 L", "12 x 0,5 L"], priceRange: [3.9, 7.5], descParts: ["spritzig", "mit Kohlensäure"], tags: ["getränk", "wasser"] },
      { base: "Cola Zero", units: ["6 x 0,33 L", "1,5 L"], priceRange: [4.5, 8.9], descParts: ["ohne Zucker", "koffeinhaltig"], tags: ["getränk", "softdrink"] },
      { base: "Apfelschorle", units: ["6 x 1 L"], priceRange: [3.5, 6.9], descParts: ["erfrischend", "naturtrüb"], tags: ["getränk", "schorle"] },
    ],
  },
  {
    category: "Getränke",
    subcategory: "Kaffee & Tee",
    brands: ["Dallmayr", "Lavazza", "Melitta", "Teekanne", "Meßmer"],
    archetypes: [
      { base: "Caffè Crema ganze Bohne", units: ["1 kg", "500 g"], priceRange: [7.9, 16.9], descParts: ["vollmundig", "100% Arabica"], tags: ["kaffee"] },
      { base: "Espresso gemahlen", units: ["250 g", "500 g"], priceRange: [3.9, 8.9], descParts: ["kräftig", "italienische Röstung"], tags: ["kaffee"] },
      { base: "Grüner Tee Sencha", units: ["20 Beutel"], priceRange: [1.9, 4.5], descParts: ["aromatisch", "belebend"], tags: ["tee"] },
    ],
  },
  {
    category: "Vorratskammer",
    subcategory: "Nudeln, Reis & Co.",
    brands: ["Barilla", "De Cecco", "Oryza", "Alnatura", "Mueller's"],
    archetypes: [
      { base: "Spaghetti No.5", units: ["500 g", "1 kg"], priceRange: [0.9, 2.6], descParts: ["aus Hartweizengrieß", "al dente"], tags: ["nudeln", "vegan"] },
      { base: "Basmati Reis", units: ["1 kg", "500 g"], priceRange: [2.2, 5.4], descParts: ["langkörnig", "duftend"], tags: ["reis", "vegan"] },
      { base: "Vollkorn-Penne", units: ["500 g"], priceRange: [1.2, 2.9], descParts: ["ballaststoffreich", "bissfest"], tags: ["nudeln", "vegan"] },
      { base: "Rote Linsen", units: ["500 g", "250 g"], priceRange: [1.4, 3.2], descParts: ["proteinreich", "schnell gar"], tags: ["hülsenfrüchte", "vegan"] },
    ],
  },
  {
    category: "Süßes & Salziges",
    subcategory: "Schokolade & Riegel",
    brands: ["Ritter Sport", "Milka", "Lindt", "Kinder", "Vego"],
    archetypes: [
      { base: "Vollmilch-Schokolade", units: ["100 g", "2 x 100 g"], priceRange: [0.9, 2.9], descParts: ["zartschmelzend", "Alpenmilch"], tags: ["schokolade", "süßigkeiten"] },
      { base: "Zartbitter 70%", units: ["100 g"], priceRange: [1.2, 3.4], descParts: ["intensiv", "kakaoreich"], tags: ["schokolade"] },
      { base: "Haselnuss-Riegel", units: ["5er Pack"], priceRange: [1.6, 3.9], descParts: ["knackig", "für unterwegs"], tags: ["riegel", "snack"] },
    ],
  },
  {
    category: "Tiefkühl",
    subcategory: "Pizza & Fertiggerichte",
    brands: ["Dr. Oetker", "Wagner", "Frosta", "Gustavo Gusto"],
    archetypes: [
      { base: "Steinofen-Pizza Margherita", units: ["350 g", "400 g"], priceRange: [2.2, 5.9], descParts: ["dünner Boden", "mit Mozzarella"], tags: ["tiefkühl", "pizza", "vegetarisch"] },
      { base: "Gemüsepfanne", units: ["480 g"], priceRange: [2.4, 4.9], descParts: ["ohne Zusatzstoffe", "in 8 Minuten fertig"], tags: ["tiefkühl", "vegan"] },
      { base: "Pommes frites Backofen", units: ["750 g", "1 kg"], priceRange: [1.8, 3.9], descParts: ["knusprig", "fettarm zubereitbar"], tags: ["tiefkühl", "vegan"] },
    ],
  },
  {
    category: "Fleisch & Fisch",
    subcategory: "Fleisch & Geflügel",
    brands: ["Knuspr Metzgerei", "Wiesenhof", "Landjunker", "Bioland"],
    archetypes: [
      { base: "Hähnchenbrustfilet", units: ["400 g", "1 kg"], priceRange: [3.9, 9.9], descParts: ["zart", "aus Bodenhaltung"], tags: ["fleisch", "geflügel", "protein"] },
      { base: "Rinderhackfleisch", units: ["400 g", "500 g"], priceRange: [3.4, 7.9], descParts: ["frisch", "mager"], tags: ["fleisch", "protein"] },
    ],
  },
  {
    category: "Fleisch & Fisch",
    subcategory: "Vegane Alternativen",
    brands: ["Rügenwalder Mühle", "Beyond Meat", "Garden Gourmet", "LikeMeat"],
    archetypes: [
      { base: "Veganes Hack", units: ["350 g"], priceRange: [2.4, 4.9], descParts: ["auf Erbsenbasis", "proteinreich"], tags: ["vegan", "fleischersatz", "protein"] },
      { base: "Vegane Bratwurst", units: ["4 Stück"], priceRange: [2.2, 4.5], descParts: ["pflanzlich", "saftig"], tags: ["vegan", "fleischersatz"] },
    ],
  },
  {
    category: "Drogerie",
    subcategory: "Körperpflege",
    brands: ["Nivea", "Balea", "Sebamed", "Weleda", "dm"],
    archetypes: [
      { base: "Duschgel Sensitive", units: ["250 ml", "500 ml"], priceRange: [0.9, 3.9], descParts: ["pH-hautneutral", "ohne Mikroplastik"], tags: ["drogerie", "pflege"] },
      { base: "Handseife Nachfüllpack", units: ["500 ml"], priceRange: [1.4, 3.9], descParts: ["pflegend", "sparsam"], tags: ["drogerie", "pflege"] },
    ],
  },
];
