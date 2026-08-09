import { convertGender } from "../gender";
import { parseYYMMDD, parseJapaneseDate } from "../date";
import { splitPostalCode } from "../postalCode";
import { splitPhoneNumber } from "../phone";
import { parseLaborInsurance } from "../laborInsurance";
import { trimFacilitySuffix } from "../name";
import { truncateKana } from "../kana";
import { parseInjuryTime } from "../time";

/**
 * ユーザー入力テキストの連想配列を schemas/form5.json の ID 一覧へ正確にバインドする
 */
export function buildForm5Data(
  rawInput: Record<string, string>,
  _fillAllForTest: boolean = false
): Record<string, string> {
  // 1. 各種ルール関数の適用・データ切り出し（テスト用デフォルト値は排除し、未入力時は空文字）
  const workerZip = splitPostalCode(
    rawInput["本人郵便番号(3桁-4桁で入力)"] || rawInput["本人郵便番号"] || ""
  );
  const hospZip = splitPostalCode(
    rawInput["診療を受けた病院郵便番号(3桁-4桁で入力)"] || rawInput["病院郵便番号"] || ""
  );
  const compZip = splitPostalCode(
    rawInput["その会社の郵便番号(3桁-4桁で入力)"] || rawInput["会社郵便番号"] || rawInput["事業場郵便番号"] || ""
  );

  const workerPhone = splitPhoneNumber(
    rawInput["本人電話番号(ハイフンで区切って入力)"] || rawInput["本人電話番号"] || ""
  );
  const hospPhone = splitPhoneNumber(
    rawInput["診療を受けた病院電話番号(ハイフンで区切って入力)"] || rawInput["病院電話番号"] || ""
  );
  const compPhone = splitPhoneNumber(
    rawInput["その会社の電話番号(ハイフンで区切って入力)"] || rawInput["会社電話番号"] || rawInput["事業場電話番号"] || ""
  );

  // 本人と所属会社が異なる場合の「その会社の電話番号」の分割処理
  const affCompPhone = splitPhoneNumber(
    rawInput["上記会社電話番号(ハイフンで区切って入力)"] || rawInput["その会社の電話番号"] || rawInput["所属会社電話番号"] || ""
  );

  const birthYmd = parseYYMMDD(
    rawInput["本人の生年月日(例、55年5月15日の場合550515と入力)"] || rawInput["生年月日"] || ""
  );
  const injuryYmd = parseYYMMDD(
    rawInput["負傷年月日(例、令和8年8月29日なら080829と入力)"] || rawInput["負傷年月日"] || ""
  );
  const proofDateYmd = parseJapaneseDate(
    rawInput["会社が事実と証明する日(和暦で入力、例、令和8年8月11日)"] || rawInput["証明日"] || ""
  );
  const fillDateYmd = parseJapaneseDate(
    rawInput["記入日(和暦で入力)"] || rawInput["記入日"] || ""
  );
  const joiningDateYmd = parseJapaneseDate(
    rawInput["その加入日(和暦で入力)"] || rawInput["加入日"] || ""
  );

  const rawTimeType = rawInput["負傷したのはAM？PM？"] || rawInput["負傷時刻区分"] || "";
  const rawHour = rawInput["負傷したのは何時(例、14時なら2時と入力)"] || rawInput["負傷時刻時"] || "";
  const rawMin = rawInput["負傷したのは何分"] || rawInput["負傷時刻分"] || "";
  const timeInfo = parseInjuryTime(rawTimeType, rawHour, rawMin);

  const laborIns = parseLaborInsurance(
    rawInput["労働保険番号(会社が入力)"] || rawInput["労働保険番号"] || ""
  );
  const specialLaborIns = parseLaborInsurance(
    rawInput["表面以外の特別加入の労働保険番号"] || rawInput["特別加入の労働保険番号"] || ""
  );

  const hospNameCleaned = trimFacilitySuffix(
    rawInput["診療を受けた病院名"] || rawInput["病院名"] || ""
  );

  const prefStr = rawInput["本人住所都道府県"] || rawInput["住所都道府県"] || "";
  const cityStr = rawInput["本人住所市町村から後"] || rawInput["住所市町村以降"] || "";
  const fullAddress = prefStr + cityStr;
  const workerName = rawInput["本人氏名"] || rawInput["氏名"] || rawInput["労働者氏名"] || "";

  // 会社情報
  const compName = rawInput["提出する会社名"] || rawInput["会社名"] || rawInput["事業場名称"] || "";
  const compAddr = rawInput["提出する会社住所"] || rawInput["会社住所"] || rawInput["事業場所在地"] || "";
  const repName = rawInput["代表者氏名"] || rawInput["代表者名"] || rawInput["事業主氏名"] || "";
  const affCompNameRep = rawInput["本人所属会社が上記と違う場合入力(会社名住所代表者名)"] || rawInput["所属会社名及び代表者氏名"] || "";

  // 就業先複数フラグ処理（「有」が入力された場合は「〇」に変換）
  const multipleRaw = rawInput["その他就業先が有る場合(有と入力無ければ空白)"] || rawInput["その他就業先"] || "";
  const multipleMark = multipleRaw === "有" || multipleRaw === "〇" ? "〇" : multipleRaw;

  // 2. form5.json の各 ID と 100% 一致するオブジェクトを返却
  return {
    // --- Page 1 (front) ---
    "Labor_insurance_No.": laborIns.full,
    "sex": rawInput["性別、男性は１女性は３と記入して下さい。"] || rawInput["性別"] || "",
    "Date_of_birth,Japanese_era": rawInput["本人の生年月日の和暦(昭和は5、平成は7、令和は9と入力)"] || rawInput["生年月日の和暦"] || "",
    "date_of_birth": (birthYmd.year || "") + (birthYmd.month || "") + (birthYmd.day || ""),
    "Date_of_injury,Japanese_era": "9", // 令和（9固定）
    "Date_of_injury": (injuryYmd.year || "") + (injuryYmd.month || "") + (injuryYmd.day || ""),
    "Name_in_Katakana": truncateKana(
      rawInput["本人の氏名カタカナで入力、姓と名の間にスペースを入れて下さい。"] || rawInput["氏名フリガナ"] || "",
      16
    ),
    "worker_name": workerName,
    "age": rawInput["年齢(数字のみ)"] || rawInput["年齢"] || "",
    "zip_first": workerZip.first,
    "zip_last": workerZip.last,
    "Personal_address_and_prefecture,and_phonetic_spelling": rawInput["本人住所都道府県フリガナ"] || "",
    "Personal_address_and_prefecture": prefStr,
    "Personal_address_in_kana": rawInput["本人住所市町村から後フリガナ"] || "",
    "Personal_address": cityStr,
    "Job_type": rawInput["本人の職種"] || rawInput["職種"] || "",
    "time_am": timeInfo.amMark,
    "time_pm": timeInfo.pmMark,
    "disaster_hour": timeInfo.hour,
    "disaster_minute": timeInfo.minute,
    "Title_of_the_person_verifying_the_facts": rawInput["負傷を確認した人の職名"] || rawInput["事実確認者の職名"] || "",
    "Name_of_the_person_who_confirmed_the_facts": rawInput["負傷を確認した人の氏名"] || rawInput["事実確認者の氏名"] || "",
    "accident_detail": rawInput["災害の原因と発生状況"] || rawInput["災害の原因及び発生状況"] || "",
    "Hospital_name": hospNameCleaned,
    "Hospital_Address": rawInput["診療を受けた病院住所"] || rawInput["病院住所"] || "",
    "Hospital_tel_area": hospPhone.area,
    "Hospital_tel_city": hospPhone.city,
    "Hospital_tel_num": hospPhone.num,
    "Hospital_zip_first": hospZip.first,
    "Hospital_zip_last": hospZip.last,
    "Location_and_condition_of_the_injury": rawInput["傷病の部位及び状態"] || rawInput["傷病部位"] || "",

    // 会社関連情報
    "Company_Name": compName,
    "Company_Address": compAddr,
    "Representative's_name": repName,
    "Year_of_proof_of_fact": proofDateYmd.year,
    "Month_of_Proof_of_Fact": proofDateYmd.month,
    "The_day_of_proof_of_facts": proofDateYmd.day,
    "Company_tel_area": compPhone.area,
    "Company_tel_city": compPhone.city,
    "Company_tel_num": compPhone.num,
    "Company_zip_first": compZip.first,
    "Company_zip_last": compZip.last,

    // 本人所属会社（異なる場合）および「その会社の電話番号」
    "Company_name_and_representative's_name": affCompNameRep,
    "The_person's_affiliated_company_tel_area": affCompPhone.area,
    "The_person's_affiliated_company_tel_city": affCompPhone.city,
    "The_person's_affiliated_company_tel_num": affCompPhone.num,

    // 請求・請求人情報
    "Area_of_the_Labor_Standards_Inspection_Office": rawInput["所轄の労基のエリア"] || rawInput["所轄労働基準監督署"] || "",
    "Claim_Hospital_name": rawInput["診療を受けた所の名前(例、労働病院なら労働のみ記入)"] || hospNameCleaned,
    "claimant_zip_first": workerZip.first,
    "claimant_zip_last": workerZip.last,
    "Year_of_entry": fillDateYmd.year,
    "Month_of_entry": fillDateYmd.month,
    "Date_of_entry": fillDateYmd.day,
    "claimant_tel_area": workerPhone.area,
    "claimant_tel_city": workerPhone.city,
    "claimant_tel_num": workerPhone.num,
    "Claimant's_address": fullAddress,
    "Claimant's_name": workerName,

    // --- Page 2 (back) ---
    "Multiple": multipleMark,
    "Number_of_workplaces": rawInput["表面以外で有る場合はその数(数字のみ入力)"] || rawInput["表面以外の就業先の数"] || "",
    "Special_Insurance_num": specialLaborIns.full,
    "Name_of_Special_Member_Organization": rawInput["その労働保険事務組合又は特別加入団体の名称"] || "",
    "Year_of_joining": joiningDateYmd.year,
    "Joining_Month": joiningDateYmd.month,
    "Joining_date": joiningDateYmd.day
  };
}
