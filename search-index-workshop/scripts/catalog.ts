// Domain vocabulary for a Knuspr-style online grocery store.
// Curated by hand so generated products read like a real supermarket catalog
// (English category names, real-sounding brands, sensible units & price ranges).

export interface Archetype {
  base: string;            // core product noun, e.g. "Oatmilk"
  units: string[];         // plausible pack sizes
  priceRange: [number, number]; // dollars, min..max
  descParts: string[];     // adjectives/claims used to build a description
  tags: string[];
}

export interface CategoryDef {
  category: string;
  subcategory: string;
  brands: string[];
  archetypes: Archetype[];
}

// Adjectives that get mixed into product names (some marketing-y).
export const NAME_PREFIXES = [
  "", "", "", "Organic", "Organic", "Fresh", "Premium", "Local", "Farmhouse",
  "Classic", "Finest", "Original", "Homemade",
];

export const BIO_BRANDS = ["WholeFoods Organic", "NatureFresh", "GreenValley", "FarmBio", "Knuspr Organic"];

export const CATALOG: CategoryDef[] = [
  {
    category: "Fruits & Vegetables",
    subcategory: "Fruit",
    brands: ["Knuspr", "Local Harvest", "NatureFresh", "GreenValley"],
    archetypes: [
      { base: "Elstar Apples", units: ["1 kg", "2 kg", "750 g"], priceRange: [1.9, 4.5], descParts: ["crisp", "sweet-tart", "from local orchards"], tags: ["fruit", "vegan", "local"] },
      { base: "Bananas", units: ["1 kg", "5 pieces"], priceRange: [1.2, 2.8], descParts: ["fair trade", "perfectly ripe", "from Ecuador"], tags: ["fruit", "vegan", "fairtrade"] },
      { base: "Strawberries", units: ["500 g", "250 g"], priceRange: [2.5, 5.9], descParts: ["sun-ripened", "aromatic", "seasonal"], tags: ["fruit", "vegan", "seasonal"] },
      { base: "Organic Lemons", units: ["500 g", "4 pieces"], priceRange: [1.8, 3.4], descParts: ["untreated peel", "zesty"], tags: ["fruit", "organic", "vegan"] },
      { base: "Blueberries", units: ["125 g", "250 g"], priceRange: [2.2, 4.8], descParts: ["rich in antioxidants", "hand-picked"], tags: ["fruit", "vegan", "superfood"] },
    ],
  },
  {
    category: "Fruits & Vegetables",
    subcategory: "Vegetables",
    brands: ["Knuspr", "Local Harvest", "GreenValley", "FarmBio"],
    archetypes: [
      { base: "Vine Tomatoes", units: ["500 g", "1 kg"], priceRange: [1.8, 3.9], descParts: ["vine-ripened", "aromatic"], tags: ["vegetable", "vegan"] },
      { base: "Carrots", units: ["1 kg", "500 g", "2 kg"], priceRange: [0.9, 2.4], descParts: ["crisp", "rich in vitamins", "local"], tags: ["vegetable", "vegan", "local"] },
      { base: "Avocado", units: ["2 pieces", "1 piece"], priceRange: [1.5, 3.9], descParts: ["ready to eat", "creamy"], tags: ["vegetable", "vegan"] },
      { base: "Organic Potatoes Waxy", units: ["1.5 kg", "2.5 kg"], priceRange: [1.6, 3.8], descParts: ["waxy", "grown locally"], tags: ["vegetable", "organic", "vegan"] },
      { base: "Baby Spinach", units: ["200 g", "125 g"], priceRange: [1.4, 2.9], descParts: ["tender", "washed", "ready to eat"], tags: ["vegetable", "vegan"] },
    ],
  },
  {
    category: "Dairy & Eggs",
    subcategory: "Milk & Drinks",
    brands: ["Meadowfresh", "Highland Dairy", "Landliebe", "Oatly", "Alpro", "NatureFresh"],
    archetypes: [
      { base: "Fresh Wholemilk 3.5%", units: ["1 L"], priceRange: [1.0, 1.8], descParts: ["from pasture-raised cows", "stays fresh longer"], tags: ["milk", "chilled"] },
      { base: "Oatmilk Barista", units: ["1 L"], priceRange: [1.6, 2.9], descParts: ["frothable", "plant-based", "no added sugar"], tags: ["milk-alternative", "vegan"] },
      { base: "Almondmilk Unsweetened", units: ["1 L"], priceRange: [1.7, 3.2], descParts: ["plant-based", "low calorie"], tags: ["milk-alternative", "vegan"] },
      { base: "Lactosefree Milk", units: ["1 L"], priceRange: [1.3, 2.2], descParts: ["easy to digest", "lactose-free"], tags: ["milk", "lactosefree"] },
    ],
  },
  {
    category: "Dairy & Eggs",
    subcategory: "Yogurt & Quark",
    brands: ["Ehrmann", "Danone", "Landliebe", "Andechser", "NatureFresh"],
    archetypes: [
      { base: "Natural Yogurt 3.8%", units: ["500 g", "1 kg"], priceRange: [0.9, 2.4], descParts: ["creamy", "mild"], tags: ["yogurt", "chilled"] },
      { base: "Greek Yogurt", units: ["400 g", "1 kg"], priceRange: [1.4, 3.2], descParts: ["high in protein", "extra creamy"], tags: ["yogurt", "protein"] },
      { base: "Skyr Vanilla", units: ["450 g", "150 g"], priceRange: [1.0, 2.6], descParts: ["low fat", "high in protein", "Icelandic style"], tags: ["yogurt", "protein"] },
      { base: "Low-fat Quark", units: ["500 g", "250 g"], priceRange: [0.8, 1.9], descParts: ["high in protein", "low fat"], tags: ["quark", "protein"] },
    ],
  },
  {
    category: "Dairy & Eggs",
    subcategory: "Cheese",
    brands: ["Bergader", "Président", "Gouda Holland", "Hochland", "Galbani"],
    archetypes: [
      { base: "Young Gouda Block", units: ["300 g", "500 g"], priceRange: [2.2, 5.9], descParts: ["mild", "firm"], tags: ["cheese", "chilled"] },
      { base: "Mozzarella", units: ["125 g", "2 x 125 g"], priceRange: [0.8, 2.4], descParts: ["for salad & pizza", "in brine"], tags: ["cheese", "vegetarian"] },
      { base: "Aged Mountain Cheese", units: ["200 g", "400 g"], priceRange: [3.5, 7.9], descParts: ["full-flavored", "aged 12 months"], tags: ["cheese"] },
      { base: "Feta", units: ["200 g"], priceRange: [1.6, 3.4], descParts: ["made from sheep's milk", "tangy"], tags: ["cheese"] },
    ],
  },
  {
    category: "Bread & Bakery",
    subcategory: "Bread",
    brands: ["Harry", "Mestemacher", "Knuspr Bakery", "Bauck Hof"],
    archetypes: [
      { base: "Rye Mixed Bread", units: ["750 g", "500 g"], priceRange: [1.4, 3.2], descParts: ["moist", "stone-baked"], tags: ["bread"] },
      { base: "Wholegrain Toast", units: ["500 g"], priceRange: [1.1, 2.4], descParts: ["high in fiber", "no preservatives"], tags: ["bread"] },
      { base: "Spelt Sourdough Bread", units: ["750 g"], priceRange: [2.2, 4.5], descParts: ["long fermentation", "full-flavored"], tags: ["bread"] },
      { base: "Glutenfree Multigrain Bread", units: ["400 g"], priceRange: [2.8, 4.9], descParts: ["gluten-free", "moist"], tags: ["bread", "glutenfree"] },
    ],
  },
  {
    category: "Beverages",
    subcategory: "Water & Soft Drinks",
    brands: ["Gerolsteiner", "Coca-Cola", "Fritz-Kola", "Adelholzener", "Volvic"],
    archetypes: [
      { base: "Mineral Water Classic", units: ["6 x 1 L", "12 x 0.5 L"], priceRange: [3.9, 7.5], descParts: ["sparkling", "carbonated"], tags: ["drink", "water"] },
      { base: "Cola Zero", units: ["6 x 0.33 L", "1.5 L"], priceRange: [4.5, 8.9], descParts: ["no sugar", "caffeinated"], tags: ["drink", "softdrink"] },
      { base: "Apple Spritzer", units: ["6 x 1 L"], priceRange: [3.5, 6.9], descParts: ["refreshing", "cloudy, naturally pressed"], tags: ["drink", "spritzer"] },
    ],
  },
  {
    category: "Beverages",
    subcategory: "Coffee & Tea",
    brands: ["Dallmayr", "Lavazza", "Melitta", "Teekanne", "Meßmer"],
    archetypes: [
      { base: "Caffè Crema Whole Bean", units: ["1 kg", "500 g"], priceRange: [7.9, 16.9], descParts: ["full-bodied", "100% Arabica"], tags: ["coffee"] },
      { base: "Espresso Ground", units: ["250 g", "500 g"], priceRange: [3.9, 8.9], descParts: ["strong", "Italian roast"], tags: ["coffee"] },
      { base: "Green Tea Sencha", units: ["20 bags"], priceRange: [1.9, 4.5], descParts: ["aromatic", "invigorating"], tags: ["tea"] },
    ],
  },
  {
    category: "Pantry",
    subcategory: "Pasta, Rice & Grains",
    brands: ["Barilla", "De Cecco", "Oryza", "NatureFresh", "Mueller's"],
    archetypes: [
      { base: "Spaghetti No.5", units: ["500 g", "1 kg"], priceRange: [0.9, 2.6], descParts: ["made from durum wheat", "al dente"], tags: ["pasta", "vegan"] },
      { base: "Basmati Rice", units: ["1 kg", "500 g"], priceRange: [2.2, 5.4], descParts: ["long-grain", "fragrant"], tags: ["rice", "vegan"] },
      { base: "Wholegrain Penne", units: ["500 g"], priceRange: [1.2, 2.9], descParts: ["high in fiber", "firm to the bite"], tags: ["pasta", "vegan"] },
      { base: "Red Lentils", units: ["500 g", "250 g"], priceRange: [1.4, 3.2], descParts: ["high in protein", "quick-cooking"], tags: ["legumes", "vegan"] },
    ],
  },
  {
    category: "Snacks & Sweets",
    subcategory: "Chocolate & Bars",
    brands: ["Ritter Sport", "Milka", "Lindt", "Kinder", "Vego"],
    archetypes: [
      { base: "Wholemilk Chocolate", units: ["100 g", "2 x 100 g"], priceRange: [0.9, 2.9], descParts: ["melts in your mouth", "alpine milk"], tags: ["chocolate", "sweets"] },
      { base: "Dark Chocolate 70%", units: ["100 g"], priceRange: [1.2, 3.4], descParts: ["intense", "rich in cocoa"], tags: ["chocolate"] },
      { base: "Hazelnut Bar", units: ["5-pack"], priceRange: [1.6, 3.9], descParts: ["crunchy", "on the go"], tags: ["bar", "snack"] },
    ],
  },
  {
    category: "Frozen",
    subcategory: "Pizza & Ready Meals",
    brands: ["Dr. Oetker", "Wagner", "Frosta", "Gustavo Gusto"],
    archetypes: [
      { base: "Stone-Baked Pizza Margherita", units: ["350 g", "400 g"], priceRange: [2.2, 5.9], descParts: ["thin crust", "with mozzarella"], tags: ["frozen", "pizza", "vegetarian"] },
      { base: "Vegetable Stir-Fry Mix", units: ["480 g"], priceRange: [2.4, 4.9], descParts: ["no additives", "ready in 8 minutes"], tags: ["frozen", "vegan"] },
      { base: "Oven Fries", units: ["750 g", "1 kg"], priceRange: [1.8, 3.9], descParts: ["crispy", "low-fat preparation"], tags: ["frozen", "vegan"] },
    ],
  },
  {
    category: "Meat & Fish",
    subcategory: "Meat & Poultry",
    brands: ["Knuspr Butchery", "Wiesenhof", "Landjunker", "FarmBio"],
    archetypes: [
      { base: "Chicken Breast Fillet", units: ["400 g", "1 kg"], priceRange: [3.9, 9.9], descParts: ["tender", "free-range"], tags: ["meat", "poultry", "protein"] },
      { base: "Ground Beef", units: ["400 g", "500 g"], priceRange: [3.4, 7.9], descParts: ["fresh", "lean"], tags: ["meat", "protein"] },
    ],
  },
  {
    category: "Meat & Fish",
    subcategory: "Plant-Based Alternatives",
    brands: ["Rügenwalder Mühle", "Beyond Meat", "Garden Gourmet", "LikeMeat"],
    archetypes: [
      { base: "Vegan Ground Meat", units: ["350 g"], priceRange: [2.4, 4.9], descParts: ["pea-based", "high in protein"], tags: ["vegan", "meatalternative", "protein"] },
      { base: "Vegan Bratwurst", units: ["4 pieces"], priceRange: [2.2, 4.5], descParts: ["plant-based", "juicy"], tags: ["vegan", "meatalternative"] },
    ],
  },
  {
    category: "Personal Care",
    subcategory: "Body Care",
    brands: ["Nivea", "Balea", "Sebamed", "Weleda", "dm"],
    archetypes: [
      { base: "Shower Gel Sensitive", units: ["250 ml", "500 ml"], priceRange: [0.9, 3.9], descParts: ["pH-skin-neutral", "microplastic-free"], tags: ["personalcare", "care"] },
      { base: "Hand Soap Refill", units: ["500 ml"], priceRange: [1.4, 3.9], descParts: ["nourishing", "economical"], tags: ["personalcare", "care"] },
    ],
  },
];
