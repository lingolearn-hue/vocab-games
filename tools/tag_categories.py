import json, re, collections

KEYWORDS = {
    'animals': r'\b(animal|dog|cat|bird|fish|horse|cow|pig|sheep|goat|mouse|mice|rat|fox|wolf|bear|lion|tiger|elephant|monkey|snake|frog|toad|insect|bee|wasp|fly|butterfly|moth|spider|ant|duck|goose|chicken|hen|rooster|rabbit|deer|stag|squirrel|owl|eagle|hawk|falcon|whale|dolphin|shark|turtle|tortoise|worm|caterpillar|beetle|hedgehog|donkey|mule|paw|fur|beak|wing|tail|hoof|herd|flock|livestock|poultry|pet|puppy|kitten|dinosaur|reptile|mammal|rodent|predator|prey|zoo|wildlife|nest|cage|breed|snail|slug|crab|lobster|shrimp|jellyfish|seal|otter|beaver|bat|camel|llama|zebra|giraffe|hippo|rhino|penguin|swan|peacock|parrot|crow|raven|sparrow|pigeon|stork|angler|fisherman|beast|feather)\b',
    'plants': r'\b(plant|tree|tree trunk|flower|leaf|leaves|grass|lawn|forest|wood|root|seed|bloom|blossom|twig|bush|shrub|garden|herb|weed|moss|thorn|fern|petal|bark|oak|pine|fir|birch|maple|willow|rose|tulip|daisy|lily|orchid|cactus|vine|tree branch|harvest|crop|sprout|kale|cabbage|lettuce|spinach|parsley|basil|mint|clover|carnation|sage|daffodil|sunflower|ivy|hedge)\b',
    'weather': r'\b(weather|rain|rainy|snow|snowy|sun|sunny|sunshine|cloud|cloudy|wind|windy|breeze|gust of wind|storm|thunderstorm|hurricane|tornado|fog|foggy|mist|misty|ice|icy|frost|thunder|lightning|temperature|humid|humidity|drought|climate|forecast|hail|drizzle|rain shower|autumn|degrees celsius|degrees fahrenheit)\b',
    'landscape': r'\b(mountain|hill|hillside|valley|river|stream|creek|brook|lake|pond|sea|ocean|coast|coastal|beach|shore|shoreline|island|forest|jungle|desert|field|meadow|cliff|cave|waterfall|volcano|peak|summit|plateau|landscape|scenery|panorama|horizon|terrain|wilderness|glacier|earth|land|soil|eruption|longitude)\b',
    'family': r'\b(family|mother|mom|mum|father|dad|parent|child|children|kid|son|daughter|brother|sister|sibling|grandmother|grandma|grandfather|grandpa|grandparent|grandchild|grandson|granddaughter|aunt|uncle|cousin|nephew|niece|husband|wife|spouse|marriage|married|marry|wedding|relative|in-law|stepmother|stepfather|stepson|stepdaughter|widow|widower|fiance|twin|heir|heiress|orphan|godfather|godmother|newlywed|childcare|adolescence|ancestor)\b',
    'body': r'\b(body|head|hair|eye|ear|nose|mouth|tooth|teeth|tongue|neck|shoulder|arm|handshake|finger|thumb|leg|foot|feet|toe|knee|chest|lower back|back pain|backache|spine|stomach|belly|skin|blood|bone|heart|lung|liver|kidney|brain|muscle|throat|chin|forehead|cheek|elbow|wrist|ankle|hip|waist|lip|eyebrow|eyelash|eyelid|fingernail|toenail|vein|artery|joint|body organ|sweat|saliva|breath|pulse)\b',
    'emotions': r'\b(happy|happiness|glad|sad|sadness|unhappy|angry|anger|mad|afraid|fear|scared|frighten|love|loving|hate|hatred|hateful|joy|joyful|proud|pride|shame|ashamed|embarrass|jealous|jealousy|envy|worried|worry|anxious|anxiety|surprised|surprise|astonish|disappoint|excite|excited|excitement|bore|bored|boredom|relief|relieved|hope|hopeful|hopeless|nervous|calm|feeling|emotion|mood|grief|grieve|grateful|gratitude|thankful|guilt|guilty|regret|comfort|comforting|miss someone|homesick|longing|sympathy|compassion|patience|impatient|courage|brave|cowardly|content|satisfaction|frustrat)\b',
    'appearance': r'\b(beautiful|beauty|gorgeous|handsome|pretty|ugly|tall|thin|slim|slender|fat|overweight|chubby|attractive|appearance|looks|good-looking|elegant|neat|tidy|messy|shabby|wrinkle|wrinkled|blond|blonde|bald|muscular|figure|posture|complexion|freckle|dimple|earring|facelift|makeup|jewelry|necklace|bracelet)\b',
    'food': r'\b(food|eat|eating|drink|drinking|meal|breakfast|lunch|dinner|supper|bread|meat|beef|pork|chicken|fish|vegetable|fruit|apple|banana|orange|grape|berry|potato|rice|pasta|noodle|noodles|soup|stew|salad|cheese|milk|butter|cream|egg|sugar|salt|pepper|spice|cinnamon|flour|cook|cooking|recipe|bake|baking|kitchen|restaurant|cafe|menu|taste|tasty|delicious|flavor|sour|hungry|thirsty|beverage|coffee|tea|wine|beer|juice|whiskey|whisky|snack|dessert|cake|cookie|chocolate|sausage|onion|garlic|tomato|cucumber|carrot|nut|honey|jam|dough|dish|ingredient|leftover|diet|vegan|vegetarian|veggie|nutrition|calorie|appetite|serving|portion|doughnut|donut|dumpling|marzipan|pastry|pretzel|pancake|waffle|drinker|coconut|cupcake|avocado|mango|pineapple|lemon|lime|peach|pear|strawberry|watermelon|almond|walnut|peanut|shrimp|seafood|lettuce|spinach|broth|sauce|mustard|mayonnaise|olive oil|yogurt|tortilla|taco|burrito|guacamole|bean|beans|pea|peas)\b',
    'clothing': r'\b(cloth|clothes|clothing|garment|shirt|blouse|trousers|pants|jeans|dress|skirt|jacket|coat|shoe|shoes|boot|sneaker|sock|hat|cap|glove|scarf|belt|button|zipper|sleeve|collar|fabric|textile|wear|wearing|fashion|sew|sewing|tailor|underwear|pocket|wool|cotton|silk|leather|suit|necktie|clothing style|uniform|costume|apron|pajama|swimsuit)\b',
    'home': r'\b(house|home|apartment|flat|room|kitchen|bathroom|bedroom|living room|living space|dining room|hallway|entrance hall|lobby|attic|basement|cellar|door|window|wall|roof|floor|ceiling|furniture|table|chair|bed|sofa|couch|shelf|lamp|light bulb|chandelier|garden|yard|key|lock|stair|staircase|garage|balcony|terrace|household|curtain|carpet|rug|mirror|closet|wardrobe|drawer|blanket|pillow|towel|kitchen sink|oven|stove|fridge|refrigerator|dishwasher|washing machine|vacuum|broom|tenant|landlord|rent|renting|move house|moving house|move out|move in|changing residence|neighbor|neighborhood|fireplace|chimney|fence|steering wheel|gate)\b',
    'shopping': r'\b(shop|shopping|store|buy|buying|sell|selling|purchase|price|cost|money|pay|paying|payment|cash|receipt|discount|sale|customer|cashier|market|supermarket|mall|cart|basket|retail|expensive|cheap|invoice|restaurant bill|utility bill|small change|give change|currency|euro|dollar|credit card|refund|voucher|coupon|buyer|toy)\b',
    'time': r'\b(day|week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|today|tomorrow|yesterday|morning|afternoon|evening|night|midnight|noon|date|calendar|season|spring|summer|autumn|winter|holiday|birthday|anniversary|century|decade|weekday|weekend|payday|pentecost|whitsun|duration|availability|available|a while|a short time|a little while|for months|for years|so far|until now|by now|nowadays|hour|dawn|archaeology|archeology|clock)\b',
    'travel': r'\b(travel|traveling|trip|journey|vacation|tourist|tourism|airport|airplane|plane|flight|train|steam locomotive|locomotive|station|platform|ship|boat|ferry|cruise|hotel|hostel|luggage|suitcase|backpack|passport|visa|ticket|border|abroad|foreign country|destination|departure|arrival|excursion|itinerary|sightseeing|guide|resort|camping|tent|snowboard|ski|skiing|ride-sharing|wildlife park|voyage|lodging|aviation)\b',
    'directions': r'\b(left|turn right|turn left|on the right|to the right|straight ahead|north|south|east|west|direction|footpath|sidewalk|walkway|signpost|corner|distance|nearby|far|move forward|go forward|step forward|move backward|step backward|behind|in front|opposite|beside|between|above|below|along|across|toward|route|path|clockwise|counterclockwise|vicinity)\b',
    'countries': r'\b(germany|german|austria|austrian|switzerland|swiss|france|french|spain|spanish|italy|italian|england|english|britain|british|europe|european|america|american|china|chinese|japan|japanese|russia|russian|poland|polish|portugal|portuguese|netherlands|dutch|belgium|belgian|greece|greek|turkey|turkish|iran|iranian|persian|india|indian|foreign country|nation|nationality|capital city|continent|citizen|foreigner|immigrant)\b',
    'traffic': r'\b(traffic|wing mirror|side mirror|roadway|highway|freeway|motorway|crossing|intersection|underpass|overpass|railway crossing|level crossing|car|bus|truck|lorry|driver|driving|drive|license plate|driving license|speed limit|traffic light|traffic jam|congestion|parking|pedestrian|cyclist|bicycle|bike|motorbike|motorcycle|vehicle|gear \(car\)|brake|accelerator|steering|lane|toll|roundabout|derailment)\b',
    'work': r'\b(work|working|job|career|profession|employee|employer|employment|unemployed|unemployment|office|company|business|colleague|coworker|boss|manager|supervisor|salary|wage|income|meeting|task|project|resign|resignation|hire|fire|firing|interview|resume|cv|contract|shift|factory|workplace|labor|union|retire|retirement|intern|apprentice|apprenticeship|internship|notice period|termination|overtime|promotion|institute|planning|childcare|translator|insurer|insurance)\b',
    'school': r'\b(school|schools|student|pupil|teacher|professor|class|classroom|lesson|homework|exam|examination|test|quiz|university|college|academy|study|studying|education|educational|grade|grading|degree|diploma|graduate|graduation|subject|lecture|semester|academic term|course|textbook|kindergarten|library|scholarship|tuition|curriculum)\b',
    'technology': r'\b(computer|laptop|internet|phone|telephone|smartphone|email|software|hardware|website|web page|app|software application|technology|technological|digital|screen|monitor|keyboard|mouse|device|gadget|battery|charger|network|wifi|bluetooth|data|download|upload|program|programming|code|robot|machine|electronic|camera|television|printer|server|password|username|computer file|folder|desktop|document|graphic|alarm|microphone|recording)\b',
    'health': r'\b(health|healthy|unhealthy|sick|sickness|illness|disease|doctor|physician|hospital|clinic|medicine|medication|drug|pain|painful|hurt|injury|injured|wound|nurse|patient|treatment|therapy|surgery|surgical operation|symptom|fever|cough|cold|flu|virus|infection|headache|toothache|asthma|cancer|rash|vaccine|vaccination|pharmacy|allergy|diagnosis|prescription|checkup|recover|recovery|disabled|disability)\b',
    'economy': r'\b(economy|economic|market|trade|trading|industry|industrial|finance|financial|bank|banking|budget|tax|taxation|inflation|investment|invest|profit|loss|debt|loan|export|import|production|producer|consumer|supply and demand|consumer demand|stock|share|shareholder|currency|expense|expenditure|revenue|recession|bankruptcy|profits|patent|finances)\b',
    'media': r'\b(media|mass communication|newspaper|magazine|journalist|journalism|report|reporting|reporter|documentary|film|movie|cinema|actor|actress|film director|movie director|theater director|broadcast|broadcasting|channel|radio|podcast|interview|headline|article|press|publish|publishing|editor|video clip|film clip|footage|episode|series|tv show|talk show|game show|reality show|host|hosting|blog|blogger|influencer|advertisement|advertising|commercial|entertainer|celebrity|fame|famous|vip|graffiti|caption|subtitle|poster)\b',
    'sports': r'\b(sport|sports|football|soccer|basketball|tennis|swimming|swim|race|racing|athlete|athletic|athletics|team|match|game|goal|score|scoring|coach|training|gym|fitness|marathon|running|olympic|olympics|championship|tournament|quarter-final|semi-final|referee|stadium|arena|venue|halftime|player|golf|golfer|skiing|cycling|bicycling|boxing|wrestling|volleyball|handball|hockey|gymnast|gymnastics|medal|trophy|victory|win|winner|lose|defeat|jersey|kit|starting eleven|starting line-up|baseball|champion|bullfighting|bullfighter|bat \(sports\))\b',
    'politics': r'\b(politic|politics|political|government|president|minister|parliament|election|elect|vote|voting|voter|legal|legislation|policy|democracy|democratic|republic|senate|congress|mayor|elected|ambassador|embassy|diplomat|diplomatic|consul|treaty|peace treaty|party member|political party|campaign|protest|rally|reform|constitution|citizenship|head of state|welfare state|federal state|nation-state|bureaucracy|bureaucrat)\b',
    'music': r'\b(music|musical|song|sing|singer|singing|melody|tune|rhythm|musical beat|drumbeat|band|orchestra|choir|chorus|musical instrument|guitar|piano|violin|drum|drums|trumpet|flute|concert|album|lyrics|composer|compose|conductor|note \(music\)|chord|opera|symphony|wind orchestra|brass band|dj|playlist|rapper|rap music|accordion|saxophone|cello|harp|clarinet|cymbal|tambourine|maracas|castanets|karaoke)\b',
    'art': r'\b(art|artist|artistic|painting|paint|painter|sculpture|sculptor|gallery|museum|exhibition|exhibit|architecture|architect|piazza|plaza|monument|statue|canvas|masterpiece|portrait|drawing|sketch|craft|handicraft|design \(art\))\b',
    'quantity': r"\b(many|much|few|a little|a little bit|some|all of|every|each|several|enough|sufficient|more|less|most|least|amount|quantity|number of|plenty|entire|whole|half|dozen|calculation|approximately|roughly|one(?!'s)|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|twenty|thirty|forty|fifty|hundred|thousand|million|billion|zero|number|numeral|digit|figure|count|counting|first|second|third|fourth|fifth|dozen)\b",
    'function_words': r'\b(who|what|when|where|why|which|whom|whose|because|therefore|however|although|though|since|whereas|thus|hence|moreover|furthermore|nevertheless|otherwise|meanwhile|besides|so that|in order to|despite|unless|in addition|as well as|consequently|likewise|instead)\b',
    'grammar': r'\b(verb|noun|adjective|adverb|pronoun|preposition|postposition|grammatical particle|conjunction|definite article|indefinite article|tense|plural|singular|grammatical subject|grammatical object|clause|sentence|grammar|grammatical|syntax|conjugation|declension|suffix|prefix|vowel|consonant|phrase|kana)\b',
    'physics': r'\b(physics|energy|force|gravity|velocity|speed|atomic mass|body mass|motion|momentum|electric|electricity|magnet|magnetic|wave|frequency|heat|thermal|pressure|atom|atomic|subatomic particle|radiation|voltage|electric current|electrical current|circuit|friction|magnetism)\b',
    'chemistry': r'\b(chemistry|chemical|element|compound|reaction|acid|alkaline|base|molecule|molecular|chemical solution|mixture|gas|liquid|solid state|oxygen|hydrogen|carbon|nitrogen|metal|alloy|catalyst|combustion|copper)\b',
    'biology': r'\b(biology|biological|cell|cellular|organism|gene|genetic|dna|rna|evolution|evolutionary|ecosystem|bacteria|bacterium|virus|body organ|tissue|photosynthesis|chromosome|habitat|reproduction|microscope)\b',
}

LEAF_ORDER = list(KEYWORDS.keys())
COMPILED = {leaf: re.compile(pattern, re.IGNORECASE) for leaf, pattern in KEYWORDS.items()}


PAREN_STRIP_CHARS = str.maketrans('()', '  ')

# Phrases that trigger a keyword match but mean something unrelated to that
# category — scrubbed before matching rather than editing every keyword,
# since new instances of this keep turning up in spot checks.
IDIOM_SCRUBS = [
    'track and field',   # sports term, not landscape ("field")
    'boot up',           # computer term, not footwear ("boot")
    'reboot',
    'record player',     # media device, not a sports "player"
    'baseball bat',      # sports equipment, not the animal
    'to bear',           # "to endure", not the animal
    'trade show',        # exhibition, not a media "show"
    'belly button',       # anatomy term, not a clothing fastener
    'power plant',        # factory, not the botanical "plant"
    'playing field',      # sports pitch, not landscape "field"
    'golf course',        # sports, not an academic "course"
    'to jam',              # "to jam/stick", not fruit jam
    'musical taste',       # taste in music, not food taste
    'wing mirror',         # car part, not an animal "wing"
    '(plural)',            # grammatical-number annotation, not about grammar itself
    'half-timbered',       # architecture term, not the quantifier "half"
    'factory plant',       # "factory, plant" — same word, industrial sense
    'water treatment plant',  # infrastructure, not the botanical "plant"
    'to bore',             # "to drill", not the emotion "bored"
    'dog owner', 'cat owner', 'pet owner', 'of a pet',  # a person, not the animal
    'of course',           # figure of speech, not an academic "course"
    'porcelain china',     # chinaware, not the country
    'japanese harp',       # a musical instrument (koto), not about Japan
    'sentence punishment',  # a legal/prison sentence, not a grammatical one
    'strike match', 'strike (match)',  # lighting a match, not a sports "match"
    'frost glass', 'frost (glass)',    # etching/frosting glass, not weather frost
    'spring up',           # "to sprout/grow suddenly", not the season
    'debt of gratitude',   # an obligation, not literal financial debt
    'used by children',    # usage-note about who says a phrase, not about family
    'neg. verb',           # grammar-annotation shorthand, not the word's own meaning
    'genuine article',     # "the real thing", not a written article
    'ice cream',           # dessert, not weather "ice"
    'chinese character', 'japanese reading',   # kanji/kana linguistics terms, not about the countries
    'settlement solution resolution',  # resolving a problem, not a chemistry solution
    'national diet',        # the Japanese parliament, not eating "diet"
    'official or otherwise', # figure of speech, not the connector "otherwise"
    '(sing)',                # grammatical abbreviation for "singular", not to sing
    'seeing one off',        # generic pronoun "one", not the numeral
    'looking forward to',    # idiom, not directional "forward"
    'matter of taste',       # idiom ("to each their own"), not food "taste"
    '(money) on hand',       # "on hand/nearby", not a shopping term
    'suspended sentence', 'prison sentence', 'life sentence', 'jail sentence',  # legal sentence, not grammatical
    'mother of pearl',        # nacre, not a family member
    'to admit (defeat',       # "admit defeat" idiom, not a sports loss
    'admit defeat',
    'warp (textile)',         # weaving term, not clothing/fashion
    'channel (tcm)',          # a body meridian, not a media channel
    'show filial piety',      # idiom, not a media "show"
    'act as host',            # hosting a meal/event, not a media host
    'to turn over', 'turn pages', 'turn traitor',  # "turn" idioms, not directional
    'lose someone',           # bereavement, not a sports loss
    'vitality; energy',       # personal vigor, not physics energy
    'glass; grass',           # loanword "glass" only; "grass" is stray gloss noise
    'table of contents',      # a book's TOC, not furniture
    'claim report',            # filing a claim, not a media report
    'diet building',           # parliament ("Diet"), not a food diet
    'pretty much', 'pretty good', 'pretty well', 'pretty bad',  # intensifier "pretty", not attractive
    'seal (used for signature)',   # a stamp, not the animal
    'expectation, forecast',       # a general expectation, not weather
    'broken heart',                # heartbreak (emotion), not the organ
    'to herd, to corner, to drive',  # figurative "corner someone", not herding animals
    'variation shift',             # a change, not a work shift
    'drive out',                   # to expel, not to operate a vehicle
    'wear beard',                  # facial hair, not clothing
    'uniform equal',               # "uniformly", not a garment
    'as a verb it means',          # meta-linguistic gloss note, not grammar itself
    'half of japan',                # a region, not a fraction
    'shooting discharge',          # firing a weapon, not a job/medical discharge
    'to cut (hair)',                # covers mowing/harvesting too, not just hair
    'game of tag',                  # folklore figure, not sports
    'article goods',                # a physical item, not a news article
    '(foot) race',                  # foot-race idiom, not general athletics
    'race (of people)',             # ethnicity, not a sports race
    'goods; taste',                 # refinement/elegance, not culinary taste
    'medical examination',          # a doctor's exam, not a school exam
    'grade stage',                  # a phase/degree, not a school grade
    'used as a verb',                # meta-linguistic gloss note, not grammar itself
    'pursue (course)',              # a course of action, not an academic course
    'stair grade',                   # a physical stair, not a school grade
    'copper engraving',              # an art technique, not the metal itself
]


def _match_text(text):
    for phrase in IDIOM_SCRUBS:
        text = text.replace(phrase, ' ')
    text = text.translate(PAREN_STRIP_CHARS)
    hits = []
    for leaf in LEAF_ORDER:
        if COMPILED[leaf].search(text):
            hits.append(leaf)
    return hits


def _fallback(pos):
    if pos == 'verb':
        return ['verbs']
    if pos == 'conj':
        return ['function_words']
    if pos == 'numeral':
        return ['quantity']
    return ['concepts']


def classify(translations, pos):
    """
    Classify primarily by the TARGET word's actual meaning — approximated
    by translations[0], the primary/first-listed sense — rather than by
    matching keywords against every listed sense bag-of-words style.

    This matters: a translation array can list several senses of the same
    string (e.g. German "Werk" = "work, factory, plant"), and the old
    approach of joining them all into one blob and matching any keyword
    against any sense meant a RARE or SECONDARY sense could hijack the
    category — "Werk" got tagged 'plants' off the botanical meaning of
    "plant" even though the word is about a factory/workplace. That's not
    a keyword-precision bug (which IDIOM_SCRUBS below fixes), it's a
    category-of-bug: matching on the wrong sense entirely, of a word whose
    PRIMARY sense would have given the right answer.

    Secondary senses are still checked as a fallback if the primary sense
    alone gives no match at all — something is usually better than
    'concepts' by default — but words classified only via a secondary
    sense are inherently lower-confidence than a primary-sense match, and
    deserve extra attention in spot-checks.
    """
    if not translations:
        return _fallback(pos)

    # "Porcelain" + "china" as separate senses of the same word (chinaware)
    # is a collision a simple IDIOM_SCRUBS phrase can't catch anymore now
    # that primary/secondary senses are checked separately — they're two
    # distinct list items, never joined into one string to scrub. Handled
    # directly instead: drop the "china" sense when "porcelain" is also
    # present, since that combination is always chinaware, not the country.
    lowered = [t.strip().lower() for t in translations]
    if 'porcelain' in lowered and 'china' in lowered:
        translations = [t for t in translations if t.strip().lower() != 'china']
    # Same idea: "spring" + "fountain" together always means the water
    # source, never the season — but "spring" alone would otherwise match
    # the season keyword before "fountain" (in a later sense) ever gets
    # checked.
    if 'spring' in lowered and 'fountain' in lowered:
        translations = [t for t in translations if t.strip().lower() != 'spring']

    primary_text = translations[0].lower()
    hits = _match_text(primary_text)
    if hits:
        return hits

    if len(translations) > 1:
        secondary_text = ' '.join(translations[1:]).lower()
        hits = _match_text(secondary_text)
        if hits:
            return hits

    return _fallback(pos)


def run(path, level):
    d = json.load(open(path))
    keys = d['keys']
    entries = d['entries']
    idx_trans = keys.index('translation')
    idx_pos = keys.index('pos')
    idx_cat = keys.index('categories')
    idx_level = keys.index('level')

    counter = collections.Counter()
    total = 0
    for e in entries:
        if e[idx_level] != level:
            continue
        if e[idx_cat]:
            continue
        total += 1
        cats = classify(e[idx_trans], e[idx_pos])
        e[idx_cat] = cats
        for c in cats:
            counter[c] += 1

    json.dump(d, open(path, 'w'), ensure_ascii=False)
    print(f'{level}: tagged {total} words')
    for k, v in counter.most_common():
        print(f'   {k}: {v} ({v/total:.1%})')


if __name__ == '__main__':
    import sys
    run(sys.argv[1], sys.argv[2])
