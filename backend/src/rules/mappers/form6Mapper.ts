import { RawInputData, MappedFormData } from "../../types/form";
import {
  getVal,
  padGridValue,
  parsePhone,
  parseZip,
  parseFlexibleDate,
  toHalfWidth,
  wrapText
} from "../utils/textUtils";

/**
 * 様式第6号専用データマッパー
 * 本人入力の14桁労働保険番号から「前2桁(府県)」と「残り12桁」を自動抽出し、専用のJSON IDへ割り当てます。
 */
export function buildForm6Data(rawInput: RawInputData): MappedFormData {
  const v = (key: string) => getVal(rawInput, key);

  // 1. 本人入力の14桁労働保険番号を取得し、2桁と12桁に分割
  const rawLaborIns = v("労働保険番号") || 
                      v("労働保険番号(会社が入力)") || 
                      (v("労働保険番号_府県(2桁)") + v("労働保険番号_所掌(1桁)") + v("労働保険番号_管轄(2桁)") + v("労働保険番号_基幹番号(6桁)") + v("労働保険番号_枝番号(3桁)"));
  const full14Digits = padGridValue(rawLaborIns, 14);

  const laborInsFirst = full14Digits.slice(0, 2);  // 前2桁（府県コード）
  const laborInsLast  = full14Digits.slice(2, 14); // 残り12桁

  // 2. 郵便番号・電話番号
  const workerZip   = parseZip(v("本人郵便番号(例: 123-4567)"));
  const workerPhone = parsePhone(v("本人電話番号(例: 090-1234-5678)"));
  const compZip     = parseZip(v("証明会社郵便番号(例: 604-8130)"));
  const compPhone   = parsePhone(v("証明会社電話番号(例: 075-221-8800)"));

  // 3. 日付分解
  const birthYmd     = parseFlexibleDate(v("生年月日(例: 55年5月15日→550515)"));
  const injuryYmd    = parseFlexibleDate(v("負傷年月日(例: 令和8年8月29日→080829)"));
  const proofDateYmd = parseFlexibleDate(v("事業主証明年月日(例: 令和8年7月29日)"));
  const fillDateYmd  = parseFlexibleDate(v("記入日(例: 令和8年8月30日)"));

  // 4. 氏名・住所・監督署
  const workerName  = v("氏名(漢字)");
  const prefStr     = v("住所都道府県");
  const cityStr     = v("住所市町村以降");
  const fullAddress = prefStr + cityStr;

  let inspectorateOffice = v("管轄労働基準監督署名(例: 京都南)");
  if (inspectorateOffice && !inspectorateOffice.endsWith("労働基準監督署")) {
    inspectorateOffice += "労働基準監督署";
  }

  return {
    // 【Form6専用：労働保険番号の分割割り当て】
    "Labor_insurance_No._first": laborInsFirst,
    "Labor_insurance_No._last":  laborInsLast,

    // 【引き継ぎ・基本項目】
    "sex": v("性別(男性は1、女性は3)"),
    "Date_of_birth,Japanese_era": v("生年月日の和暦(昭和5, 平成7, 令和9)"),
    "date_of_birth": `${birthYmd.year}${birthYmd.month}${birthYmd.day}`,
    "Date_of_injury,Japanese_era": "9",
    "Date_of_injury": `${injuryYmd.year}${injuryYmd.month}${injuryYmd.day}`,
    "Name_in_Katakana": v("氏名フリガナ(全角カタカナ・姓と名の間にスペース)").slice(0, 16),
    "worker_name": workerName,
    "age": toHalfWidth(v("年齢(数字のみ)")),

    "zip_first": workerZip.first,
    "zip_last": workerZip.last,

    "Personal_address_and_prefecture,and_phonetic_spelling": v("住所都道府県フリガナ"),
    "Personal_address_and_prefecture": prefStr,
    "Personal_address_in_kana": v("住所市町村以降フリガナ"),
    "Personal_address": cityStr,
    "Job_type": v("職種"),

    "accident_detail": wrapText(v("災害の原因と発生状況"), 30),
    "Location_and_condition_of_the_injury": wrapText(v("傷病の部位及び状態"), 25),

    "Company_Name": v("証明会社名(事業の名称)"),
    "Company_Address": wrapText(v("証明会社住所(事業場の所在地)"), 28),
    "Representative's_name": v("代表者職氏名(例: 代表取締役 山田 太郎)"),
    "Year_of_proof_of_fact": proofDateYmd.year,
    "Month_of_Proof_of_Fact": proofDateYmd.month,
    "The_day_of_proof_of_facts": proofDateYmd.day,
    "Company_tel_area": compPhone.area,
    "Company_tel_city": compPhone.city,
    "Company_tel_num": compPhone.num,
    "Company_zip_first": compZip.first,
    "Company_zip_last": compZip.last,

    "Area_of_the_Labor_Standards_Inspection_Office": inspectorateOffice,
    "Year_of_entry": fillDateYmd.year,
    "Month_of_entry": fillDateYmd.month,
    "Date_of_entry": fillDateYmd.day,
    "claimant_tel_area": workerPhone.area,
    "claimant_tel_city": workerPhone.city,
    "claimant_tel_num": workerPhone.num,
    "Claimant's_address": fullAddress,
    "Claimant's_name": workerName,

    // Form 6 特有項目（追加入力分があれば反映）
    "Medical_expenses_claimed": v("請求金額") || "",
    "Bank_name": v("振込先銀行名") || "",
    "Branch_name": v("振込先支店名") || "",
    "Account_number": v("口座番号") || ""
  };
}
