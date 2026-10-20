/**
 * Cambodian administrative hierarchy used by the cascading address pickers.
 *
 * This is a representative subset covering the provinces ARG TECH currently
 * operates in — enough to exercise the four-level cascade. A backend would
 * serve the full national gazetteer through the same shape.
 */

export interface CommuneNode {
  name: string;
  villages: string[];
}
export interface DistrictNode {
  name: string;
  communes: CommuneNode[];
}
export interface ProvinceNode {
  name: string;
  districts: DistrictNode[];
}

export const PROVINCES: ProvinceNode[] = [
  {
    name: "Siem Reap",
    districts: [
      {
        name: "Siem Reap",
        communes: [
          { name: "Svay Dangkum", villages: ["Wat Bo", "Taphul", "Steung Thmey"] },
          { name: "Sala Kamreuk", villages: ["Kruos", "Vihear Chen", "Trang"] },
        ],
      },
      {
        name: "Angkor Chum",
        communes: [
          { name: "Kouk Doung", villages: ["Kouk Doung", "Ta Yaek", "Prey Chrouk"] },
          { name: "Char Chhuk", villages: ["Char Chhuk", "Rumchek"] },
        ],
      },
      {
        name: "Puok",
        communes: [
          { name: "Kandaek", villages: ["Kandaek", "Prey Chruk"] },
          { name: "Reul", villages: ["Reul", "Doun Kaev", "Sasar Sdam"] },
        ],
      },
    ],
  },
  {
    name: "Battambang",
    districts: [
      {
        name: "Battambang",
        communes: [
          { name: "Svay Por", villages: ["Kammeakkar", "Romchek 4", "Prek Mohatep"] },
          { name: "Tuol Ta Ek", villages: ["Boeng Chhouk", "Ou Char"] },
        ],
      },
      {
        name: "Banan",
        communes: [
          { name: "Kantueu Muoy", villages: ["Kantueu", "Ph'av", "Snoeng"] },
          { name: "Chheu Teal", villages: ["Chheu Teal", "Ta Kream"] },
        ],
      },
      {
        name: "Thma Koul",
        communes: [
          { name: "Ta Pung", villages: ["Ta Pung", "Bansay Traeng"] },
          { name: "Anlong Vil", villages: ["Anlong Vil", "Kouk Khmum"] },
        ],
      },
    ],
  },
  {
    name: "Kampong Cham",
    districts: [
      {
        name: "Kang Meas",
        communes: [
          { name: "Angkor Ban", villages: ["Prek Koy"] },
          { name: "Ampil", villages: ["Kampong Tnaot", "Prey Kmeng"] },
          { name: "Chrey Vien", villages: ["Prek Tonloap"] },
        ],
      },
      {
        name: "Srey Santhor",
        communes: [
          { name: "Baray", villages: ["Ta Ong"] },
          { name: "Kaoh Krabei", villages: ["Prek Dambouk"] },
        ],
      },
      {
        name: "Kampong Siem",
        communes: [
          {
            name: "Kampong Siem",
            villages: ["Ampil", "Kien Chrey", "Ta Prok", "Prek Pdau"],
          },
          { name: "Hanchey", villages: ["Hanchey", "Sambour"] },
          { name: "Veal Vong", villages: ["Veal Vong"] },
        ],
      },
      {
        name: "Batheay",
        communes: [
          { name: "Batheay", villages: ["Batheay", "Chealea", "Me Pring"] },
          { name: "Cheyou", villages: ["Cheyou", "Sandaek"] },
        ],
      },
    ],
  },
  {
    name: "Kampot",
    districts: [
      {
        name: "Kampot",
        communes: [
          { name: "Kampong Kandal", villages: ["Kandal", "Tuek Chhou", "Andoung Khmer"] },
          { name: "Traeuy Kaoh", villages: ["Traeuy Kaoh", "Kampong Bay"] },
        ],
      },
      {
        name: "Chhuk",
        communes: [
          { name: "Chhuk", villages: ["Chhuk", "Trapeang Reang"] },
          { name: "Satv Pong", villages: ["Satv Pong", "Kandaol"] },
        ],
      },
    ],
  },
  {
    name: "Kandal",
    districts: [
      {
        name: "Sa'ang",
        communes: [
          { name: "Prek Koy", villages: ["Prek Koy", "Kaoh Khsach Tonlea"] },
          { name: "Svay Prateal", villages: ["Svay Prateal", "Roka Khpos"] },
        ],
      },
      {
        name: "Kien Svay",
        communes: [
          { name: "Kokir", villages: ["Kokir", "Dei Edth"] },
          { name: "Banteay Dek", villages: ["Banteay Dek", "Samrong Thum"] },
        ],
      },
    ],
  },
  {
    name: "Takeo",
    districts: [
      {
        name: "Daun Kaev",
        communes: [
          { name: "Roka Knong", villages: ["Roka Knong", "Baray"] },
          { name: "Lumchang", villages: ["Lumchang", "Prey Khmeng"] },
        ],
      },
      {
        name: "Bati",
        communes: [
          { name: "Krang Thnong", villages: ["Krang Thnong", "Tnaot"] },
          { name: "Doung", villages: ["Doung", "Pea Ream"] },
        ],
      },
    ],
  },
  {
    name: "Kampong Speu",
    districts: [
      {
        name: "Chbar Mon",
        communes: [
          { name: "Rokar Thum", villages: ["Rokar Thum", "Kandaol Dom"] },
          { name: "Sopoar Tep", villages: ["Sopoar Tep", "Prey Nheat"] },
        ],
      },
      {
        name: "Samraong Tong",
        communes: [
          { name: "Chong Rok", villages: ["Chong Rok", "Peang Lvea"] },
          { name: "Trapeang Kong", villages: ["Trapeang Kong", "Moha Ruesei"] },
        ],
      },
    ],
  },
  {
    name: "Phnom Penh",
    districts: [
      {
        name: "Dangkao",
        communes: [
          { name: "Prey Sa", villages: ["Prey Sa", "Kbal Damrei"] },
          { name: "Cheung Aek", villages: ["Cheung Aek", "Tien"] },
        ],
      },
      {
        name: "Por Senchey",
        communes: [
          { name: "Kakab", villages: ["Kakab 1", "Kakab 2"] },
          { name: "Chaom Chau", villages: ["Chaom Chau 1", "Trapeang Krasang"] },
        ],
      },
    ],
  },
];

export const provinceNames = (): string[] => PROVINCES.map((p) => p.name);

export const districtNames = (province: string): string[] =>
  PROVINCES.find((p) => p.name === province)?.districts.map((d) => d.name) ?? [];

export const communeNames = (province: string, district: string): string[] =>
  PROVINCES.find((p) => p.name === province)
    ?.districts.find((d) => d.name === district)
    ?.communes.map((c) => c.name) ?? [];

export const villageNames = (
  province: string,
  district: string,
  commune: string,
): string[] =>
  PROVINCES.find((p) => p.name === province)
    ?.districts.find((d) => d.name === district)
    ?.communes.find((c) => c.name === commune)?.villages ?? [];
