// Modèles de données (TypeDataModel) des acteurs et objets du système, conformes au contrat (docs/loups-contrat.md).
// Champs d'extension (absents du contrat, sans effet si on les laisse vides) : role.apparence, role.victoireCle.

import { CAMPS } from "../logique/constantes.mjs";

const { fields } = foundry.data;
const texte = (initial = "") => new fields.StringField({ required: true, blank: true, initial });
const html = () => new fields.HTMLField({ required: true, blank: true, initial: "" });
const entier = (initial = 0, min = 0) => new fields.NumberField({ required: true, nullable: false, integer: true, min, initial });
const bool = (initial = false) => new fields.BooleanField({ initial });
const camp = () => new fields.StringField({ required: true, blank: false, initial: "village", choices: CAMPS });
const usages = () => new fields.SchemaField({ max: entier(0), restant: entier(0) });

export class ModeleVillageois extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      joueur: texte(),          // id de l'utilisateur qui l'incarne ("" = personne)
      compagnon: bool(false),   // tenu par un compagnon IA (sans joueur : ses choix passent par api.resolveurs.compagnon)
      vivant: bool(true),
      revele: bool(false),      // rôle montré à tous
      camp: camp(),             // camp ACTUEL
      maison: texte(),
      amoureux: texte(),        // id de l'acteur lié
      silence: bool(false),
      protections: entier(0),
      notes: html()
    };
  }
}

export class ModeleRole extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      cle: texte(),
      camp: camp(),
      description: html(),
      victoire: html(),
      nuit: new fields.SchemaField({
        actif: bool(false),
        ordre: entier(50),
        premiereNuitSeulement: bool(false),
        uneNuitSurDeux: bool(false),
        cibles: entier(1),
        soiMeme: bool(false),
        invite: texte()
      }),
      usages: usages(),
      effet: texte(),
      // Extensions : apparence aux visions ("" = son camp ; "village" pour un loup déguisé),
      // condition de victoire lisible par la machine pour un solitaire ("" | "execute" | "dernier-survivant" | "cible-executee").
      apparence: texte(),
      victoireCle: texte()
    };
  }
}

export class ModeleMetier extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      cle: texte(),
      description: html(),
      jour: new fields.SchemaField({ actif: bool(false), invite: texte(), cibles: entier(1) }),
      usages: usages(),
      effet: texte()
    };
  }
}

export class ModeleBatiment extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      cle: texte(),
      description: html(),
      regle: html(),
      repere: texte(),
      effet: texte()
    };
  }
}

// Acteur du système : `.role` et `.metier` donnent les objets possédés (contrat : villageois() « avec .role et .metier »).
export class ActeurLoups extends Actor {
  get role() { return this.items.find(i => i.type === "role") ?? null; }
  get metier() { return this.items.find(i => i.type === "metier") ?? null; }
}
