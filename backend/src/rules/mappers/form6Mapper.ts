import { convertGender } from "../gender";
import { parseYYMMDD, parseJapaneseDate } from "../date";
import { splitPostalCode } from "../postalCode";
import { splitPhoneNumber } from "../phone";
import { parseLaborInsurance } from "../laborInsurance";
import { trimFacilitySuffix } from "../name";
import { parseInjuryTime } from "../time";

/**
 * ユーザー入力テキストの連想配列を schemas/form6.json の ID 一覧へ正確にバインドする
 */
export function buildForm6Data(
  rawInput: Record<string, string>,
  fillAllForTest: boolean = false
): Record<string, any> {
  // 1. 各種ルール関数の適用・データ切り出し
  const workerZip = splitPostalCode(
    rawInput["本人郵便番号(例: 123-4567)"] || rawInput["本人郵便番号"] || (fillAllForTest ? "611-0002" : "")
  );
  const compZip = splitPostalCode(
    rawInput["会社郵便番号"] || rawInput["事業場郵便番号"] || (fillAllForTest ? "604-8130" : "")
  );
  const mainHospZip = splitPostalCode(
    rawInput["病院郵便番号"] || rawInput["診療受けた病院の郵便番号"] || (fillAllForTest ? "600-8001" : "")
  );

  const workerPhone = splitPhoneNumber(
    rawInput["本人電話番号(例: 090-1234-5678)"] || rawInput["本人電話番号"] || (fillAllForTest ? "080-1458-7000" : "")
  );
  const compPhone = splitPhoneNumber(
    rawInput["会社電話番号"] || rawInput["事業場電話番号"] || (fillAllForTest ? "075-221-8800" : "")
  );

  const birthYmd = parseYYMMDD(
    rawInput["生年月日(例: 55年5月15日→550515)"] || rawInput["生年月日"] || (fillAllForTest ? "480219" : "")
  );
  const injuryYmd = parseYYMMDD(
    rawInput["負傷年月日(例: 令和8年8月29日→080829)"] || rawInput["負傷年月日"] || (fillAllForTest ? "080722" : "")
  );
  const fillDateYmd = parseJapaneseDate(
    rawInput["記入日(例: 令和8年8月30日)"] || rawInput["記入日"] || (fillAllForTest ? "令和8年7月29日" : "")
  );

  const gender = convertGender(
    rawInput["性別(男性は1、女性は3)"] || rawInput["性別"] || (fillAllForTest ? "1" : "")
  );

  const timeInfo = parseInjuryTime(
    rawInput["負傷時刻区分(AM または PM)"] || rawInput["負傷時刻区分"] || (fillAllForTest ? "PM" : ""),
    rawInput["負傷時刻(時)"] || rawInput["負傷時刻時"] || (fillAllForTest ? "2" : ""),
    rawInput["負傷時刻(分)"] || rawInput["負傷時刻分"] || (fillAllForTest ? "55" : "")
  );

  const laborIns = parseLaborInsurance(
    rawInput["特別加入の労働保険番号"] || rawInput["労働保険番号"] || (fillAllForTest ? "2910123456789" : "")
  );

  const prefStr = rawInput["住所都道府県"] || rawInput["都道府県"] || (fillAllForTest ? "京都府" : "");
  const cityStr = rawInput["住所市町村以降"] || rawInput["市区町村以降"] || (fillAllForTest ? "宇治市木幡御蔵山３９番地９２３号" : "");
  const fullAddress = prefStr + cityStr;
  const workerName = rawInput["氏名(漢字)"] || rawInput["氏名"] || rawInput["労働者氏名"] || (fillAllForTest ? "松井 浩愛" : "");

  // 会社情報
  const compName = rawInput["会社名"] || rawInput["事業場名称"] || (fillAllForTest ? "株式会社テスト地質コンサルタント" : "");
  const compAddr = rawInput["会社住所"] || rawInput["事業場所在地"] || (fillAllForTest ? "京都府京都市中京区烏丸通六角下ル七観音町640" : "");
  const repName = rawInput["代表者名"] || rawInput["事業主氏名"] || (fillAllForTest ? "代表取締役 山田 太郎" : "");

  // 1回目・2回目の転院先情報のパース
  const t1Zip = splitPostalCode(rawInput["1回目の病院の郵便番号(例: 123-4567)"] || rawInput["1回目の病院の郵便番号"] || "");
  const t2Zip = splitPostalCode(rawInput["2回目の病院の郵便番号(例: 123-4567)"] || rawInput["2回目の病院の郵便番号"] || "");

  // form6.json の 全 field id と完全一致するオブジェクトを出力
  return {
    // --- 表面 (Page 1) ---
    "Area_of_the_Labor_Standards_Inspection_Office": rawInput["所轄労働基準監督署"] || (fillAllForTest ? "京都南" : ""),
    "Form_number": "6",
    "Claim_Hospital_name": rawInput["請求先病院名"] || rawInput["受診病院名"] || (fillAllForTest ? "京都第一病院" : ""),
    "Year_of_entry": fillDateYmd.year,
    "Month_of_entry": fillDateYmd.month,
    "Date_of_entry": fillDateYmd.day,
    "zip_first": workerZip.first,
    "zip_last": workerZip.last,
    "claimant_tel_area": workerPhone.area,
    "claimant_tel_city": workerPhone.city,
    "claimant_tel_num": workerPhone.num,
    "Address_of_the_person_filing_the_notification": fullAddress,
    "Name_of_the_person_filing_the_notification": workerName,

    "Labor_insurance_No._first": laborIns.first2,
    "Labor_insurance_No._last": laborIns.last11,
    "worker_name": workerName,
    "male": gender.maleMark,
    "female": gender.femaleMark,
    "Year_of_birth": birthYmd.year,
    "Birth_month": birthYmd.month,
    "Birth_day": birthYmd.day,
    "age": rawInput["年齢(数字のみ)"] || rawInput["年齢"] || (fillAllForTest ? "53" : ""),
    "Claimant's_address": fullAddress,
    "Job_type": rawInput["職種"] || (fillAllForTest ? "地質調査現場作業員" : ""),

    "injury_year": injuryYmd.year,
    "injury_month": injuryYmd.month,
    "injury_day": injuryYmd.day,
    "injury_time_am": timeInfo.amMark,
    "injury_time_pm": timeInfo.pmMark,
    "disaster_minute": timeInfo.minute,
    "accident_detail": rawInput["災害の原因と発生状況"] || rawInput["災害の原因及び発生状況"] || (fillAllForTest ? "地質調査のため、ボーリング作業の貫入試験後、被災者がロッド切り離し作業を行った際、パイプレンチの取り外しが終わっていないことをマシン操作員が確認せず、スピンドルの引き上げ操作を行ったため、本体とパイプレンチに右手中指が挟まり負傷。" : ""),

    "Year_of_proof_of_fact": fillDateYmd.year,
    "Month_of_Proof_of_Fact": fillDateYmd.month,
    "The_day_of_proof_of_fact": fillDateYmd.day,

    "Company_Name": compName,
    "Company_zip_first": compZip.first,
    "Company_zip_last": compZip.last,
    "Company_tel_area": compPhone.area,
    "Company_tel_city": compPhone.city,
    "Company_tel_num": compPhone.num,
    "Company_Address": compAddr,
    "Representative's_name": repName,

    // 病院・手当情報
    "Hospital_name": trimFacilitySuffix(rawInput["病院名"] || rawInput["指定手当病院名称"] || ""),
    "Hospital_Address": rawInput["病院住所"] || rawInput["指定手当病院所在地"] || "",
    "Hospital_zip_first": mainHospZip.first,
    "Hospital_zip_last": mainHospZip.last,
    "Location_and_condition_of_the_injury": rawInput["傷病の部位及び状態"] || rawInput["傷病部位"] || (fillAllForTest ? "右手中指裂傷および不全切断" : ""),

    // 障害補償年金前払一時金関連
    "Pension_certificate_jurisdiction": rawInput["年金証書所轄"] || "",
    "Pension_certificate_type": rawInput["年金証書種別"] || "",
    "Pension_certificate_number": rawInput["年金証書番号"] || "",

    // 1回目転院先 (転院後の病院)
    "Hospital_after_transfer": trimFacilitySuffix(rawInput["1回目の転院先病院名"] || rawInput["転院先病院名"] || ""),
    "Address_of_the_hospital_after_transfer": rawInput["1回目の病院の住所"] || rawInput["転院先病院住所"] || "",
    "Postal_code_first_of_the_hospital_after_transfer": t1Zip.first,
    "Postal_code_last_of_the_hospital_after_transfer": t1Zip.last,
    "Reason_for_transfer_to_another_hospital": rawInput["1回目の転院理由(例: 精密検査・手術入院加療のため、自宅近くで通院するため 等)"] || rawInput["1回目の転院理由"] || "",

    // 2回目転院先 (年金受給後の転院可能病院)
    "Hospitals_to_which_patients_can_be_transferred_after_receiving_their_pension.": trimFacilitySuffix(rawInput["2回目の転院先病院名"] || ""),
    "Address_of_the_hospital_to_which_the_patient_is_transferred_after_receiving_the_guaranteed_pension.": rawInput["2回目の病院の住所"] || "",
    "Postal_code_first_of_the_hospital_after_payment": t2Zip.first,
    "Postal_code_last_of_the_hospital_after_payment": t2Zip.last,

    // --- 裏面 (Page 2) ---
    "Multiple": rawInput["その他就業先が有る場合(有と入力、無ければ空欄)"] || (fillAllForTest ? "無" : ""),
    "Number_of_workplaces": rawInput["表面以外の就業先の数(数字のみ)"] || (fillAllForTest ? "1" : ""),
    "Special_Insurance_num": laborIns.full,
    "Name_of_Special_Member_Organization": rawInput["労働保険事務組合等の名称"] || (fillAllForTest ? "全日本地質調査業労働保険事務組合連合会" : ""),
    "Year_of_joining": fillAllForTest ? "05" : "",
    "Joining_Month": fillAllForTest ? "04" : "",
    "Joining_date": fillAllForTest ? "01" : ""
  };
}
