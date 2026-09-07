export const SA_BANKS = [
  { name: "Absa", branchCode: "632005" },
  { name: "Access Bank", branchCode: "" },
  { name: "African Bank", branchCode: "430000" },
  { name: "Bank Zero", branchCode: "" },
  { name: "Bidvest Bank", branchCode: "462005" },
  { name: "Capitec", branchCode: "470010" },
  { name: "Discovery Bank", branchCode: "679000" },
  { name: "First National Bank", branchCode: "250655" },
  { name: "GroBank", branchCode: "" },
  { name: "HBZ Bank", branchCode: "" },
  { name: "Investec", branchCode: "580105" },
  { name: "Nedbank", branchCode: "198765" },
  { name: "Postbank", branchCode: "" },
  { name: "Sasfin", branchCode: "" },
  { name: "Standard Bank", branchCode: "051001" },
  { name: "TymeBank", branchCode: "678910" },
  { name: "Ubank", branchCode: "" },
] as const;

export const SA_BANK_OTHER = "Other";

const KNOWN_BANKS = new Set<string>(SA_BANKS.map((bank) => bank.name));

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function bankSelectValue(bankName: string) {
  if (!bankName) return "";
  if (KNOWN_BANKS.has(bankName)) return bankName;
  return SA_BANK_OTHER;
}

export function defaultBranchCode(bankName: string) {
  return SA_BANKS.find((bank) => bank.name === bankName)?.branchCode ?? "";
}

export function resolveBankName(selected: string, otherName: string) {
  if (selected === SA_BANK_OTHER) return otherName.trim();
  return selected.trim();
}

export function isAllowedBankName(name: string) {
  if (!name) return false;
  if (name === SA_BANK_OTHER) return false;
  return true;
}
