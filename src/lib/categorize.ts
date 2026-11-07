/** Odhad kategorie podle popisu (obchodník) – pro import z banky i zadání výdaje asistentem. */
export const CATEGORY_RULES: [RegExp, string][] = [
  [/(albert|lidl|billa|tesco|kaufland|penny|globus|rohlik|kosik|coop|norma|potravin|zabka|makro|pekarn|nakup)/i, "Potraviny"],
  [/(dm drogerie|rossmann|teta drogerie|drogerie)/i, "Drogerie"],
  [/(cez|pre |e\.on|eon|innogy|elektr)/i, "Elektřina"],
  [/(plyn|ppas|gas)/i, "Plyn"],
  [/(vodafone|t-mobile|o2 |telefon)/i, "Telefony"],
  [/(upc|vodafone internet|internet)/i, "Internet"],
  [/(shell|omv|benzina|orlen|mol |cerpaci|parkov|tankovani|benzin|nafta)/i, "Auto"],
  [/(dpp|cd\.cz|regiojet|leo express|jizdenk|bolt|uber|tramvaj|autobus|mhd)/i, "Doprava"],
  [/(restaur|bistro|kavarn|kafe|kava|mcdonald|kfc|wolt|foodora|pizza|obed|vecere)/i, "Restaurace"],
  [/(pojist|kooperativa|allianz|generali|uniqa|cpp)/i, "Pojištění"],
  [/(najem|najemne)/i, "Nájem"],
  [/(netflix|spotify|hbo|disney|kino|steam|zabava)/i, "Zábava"],
  [/(ikea|jysk|mobelix|hornbach|obi|bauhaus|domaci potreby)/i, "Domácí potřeby"],
];

export function guessCategoryName(text: string): string | null {
  const t = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return CATEGORY_RULES.find(([re]) => re.test(t))?.[1] ?? null;
}
