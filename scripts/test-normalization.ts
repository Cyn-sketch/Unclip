import { normalizeText } from "../src/lib/stt/normalization";

const fixture = "गो bright red कराएंगे, तुम्हें terracotta पे अडे रहना। इसके साथ walnut wood furniture बहुत classy लगता है। भरकीले यलो नहीं, पापा से कहो warm beige करना है। पापा चटकीला निला कराएंगे, तुम dusty blue पर अडे रहना। उसके साथ light wood furniture और indoor plants बहुत चांदार लगते हैं।";

console.log("--- INPUT FIXTURE ---");
console.log(fixture);

const result = normalizeText(fixture);

console.log("\n--- NORMALIZED RESULT ---");
console.log(result);

// Verification checks
const assertions = [
  { check: result.includes("वो bright red"), name: "गो -> वो" },
  { check: result.includes("पे अड़े रहना"), name: "अडे -> अड़े" },
  { check: result.includes("भड़कीले yellow"), name: "भरकीले यलो -> भड़कीले yellow" },
  { check: result.includes("चटकीला नीला"), name: "निला -> नीला" },
  { check: result.includes("शानदार लगते हैं"), name: "चांदार -> शानदार" },
  { check: result.includes("walnut wood furniture"), name: "Preserve English 'walnut wood furniture'" },
  { check: result.includes("dusty blue"), name: "Preserve English 'dusty blue'" },
  { check: result.includes("indoor plants"), name: "Preserve English 'indoor plants'" },
];

console.log("\n--- VERIFICATION CHECKS ---");
let allPassed = true;
for (const a of assertions) {
  if (a.check) {
    console.log(`PASS: ${a.name}`);
  } else {
    console.log(`FAIL: ${a.name}`);
    allPassed = false;
  }
}

if (!allPassed) {
  process.exit(1);
} else {
  console.log("\nAll normalization assertions PASSED successfully!");
}
