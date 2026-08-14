import { RawInputData, MappedFormData } from "../../types/form";
import {
  getVal,
  padGridValue,
  parsePhone,
  parseZip,
  parseFlexibleDate,
  toHalfWidth,
  wrapText,
  stripHospitalSuffix,
  formatKatakanaWithDakuon,
} from "../utils/textUtils";

export function buildForm5Data(
  rawInput: RawInputData,
  targetType: "hospital" | "pharmacy" = "hospital"
): MappedFormData {
  const v = (keys: string | string[]) => getVal(rawInput, keys);

  // 1. 本人共通情報
  const workerName = v(["氏名(漢字)", "氏名"]);

  // ★氏名フリガナのみ：マス目印字用に濁点・半濁点を独立分離
  const rawNameKana = v(["氏名フリガナ(全角カタカナ・姓と名の間にスペース)", "氏名フリガナ"]);
  const nameInKatakana = formatKatakanaWithDakuon(rawNameKana).slice(0, 16);

  const prefStr = v(["住所都道府県"]);
  // ★住所フリガナ：通常印字のため濁点分離は行わない
  const rawPrefKana = v(["住所都道府県フリガナ"]);
  const prefKana = rawPrefKana.slice(0, 27);

  const cityStr = v(["住所市町村以降"]);
  // ★住所フリガナ：通常印字のため濁点分離は行わない
  const rawCityKana = v(["住所市町村以降フリガナ"]);
  const addressInKana = rawCityKana.slice(0, 27);

  const fullAddress = prefStr + cityStr;

  const workerZip = parseZip(v(["本人郵便番号(例: 123-4567)", "本人郵便番号"]));
  const workerPhone = parsePhone(v(["本人電話番号(例: 090-1234-5678)", "本人電話番号"]));

  // 2. 労働保険番号 (14桁半角)
  const rawLaborIns = v(["労働保険番号(14桁・ハイフンなし)", "労働保険番号"]);
  const fullLaborIns = padGridValue(rawLaborIns, 14);

  // 3. 会社情報・所属事業場情報
  const compZip = parseZip(v(["証明会社郵便番号(例: 604-8130)", "証明会社郵便番号"]));
  const compPhone = parsePhone(v(["証明会社電話番号(例: 075-221-8800)", "証明会社電話番号"]));
  const affCompPhone = parsePhone(v(["その会社の電話番号(例: 03-1234-5678)", "その会社の電話番号"]));

  // 4. 病院 / 薬局 の動的切替
  const isPharmacy = targetType === "pharmacy";

  const hospName = isPharmacy
    ? (v(["調剤を受けた薬局名"]) || v(["診療を受けた病院名"]))
    : (v(["診療を受けた病院名"]) || v(["調剤を受けた薬局名"]));

  const hospAddress = isPharmacy
    ? (v(["薬局の住所"]) || v(["診療を受けた病院住所"]))
    : (v(["診療を受けた病院住所"]) || v(["薬局の住所"]));

  const hospZipRaw = isPharmacy
    ? (v(["薬局の郵便番号(例: 100-0001)", "薬局の郵便番号"]) || v(["診療を受けた病院郵便番号(例: 100-0001)", "診療を受けた病院郵便番号"]))
    : (v(["診療を受けた病院郵便番号(例: 100-0001)", "診療を受けた病院郵便番号"]) || v(["薬局の郵便番号(例: 100-0001)", "薬局の郵便番号"]));
  const hospZip = parseZip(hospZipRaw);

  const hospPhoneRaw = isPharmacy
    ? (v(["薬局の電話番号(例: 03-1234-5678)", "薬局の電話番号"]) || v(["病院電話番号(例: 03-1234-5678)", "病院電話番号"]))
    : (v(["病院電話番号(例: 03-1234-5678)", "病院電話番号"]) || v(["薬局の電話番号(例: 03-1234-5678)", "薬局の電話番号"]));
  const hospPhone = parsePhone(hospPhoneRaw);

  const cleanClaimHospName = stripHospitalSuffix(hospName);

  // 5. 各種日付の分解
  const birthYmd = parseFlexibleDate(v(["生年月日(例: 55年5月15日→550515)", "生年月日"]));
  const injuryYmd = parseFlexibleDate(v(["負傷年月日(例: 令和8年8月29日→080829)", "負傷年月日"]));
  const proofDateYmd = parseFlexibleDate(v(["事業主証明年月日(例: 令和8年7月29日)", "事業主証明年月日"]));
  const fillDateYmd = parseFlexibleDate(v(["記入日(例: 令和8年8月30日)", "記入日"]));
  const joiningDateYmd = parseFlexibleDate(v(["特別加入日(例: 令和5年4月1日)", "特別加入日"]));

  // 6. 時刻区分の判別
  const rawTimeType = v(["負傷時刻区分(AM または PMと入力)", "負傷時刻区分"]);
  const isAM = rawTimeType.toUpperCase().includes("AM");
  const isPM = rawTimeType.toUpperCase().includes("PM");

  const disasterHour = toHalfWidth(v(["負傷時刻(時・数字のみ)", "負傷時刻(時)"]));
  const disasterMinute = toHalfWidth(v(["負傷時刻(分・数字のみ)", "負傷時刻(分)"]));

  const inspectorateOffice = v(["管轄労働基準監督署名(例: 京都南)", "管轄労働基準監督署名"]);
  const multipleRaw = v(["その他就業先が有る場合(有と入力、無ければ空欄)", "その他就業先の有無"]);

  return {
    "Labor_insurance_No.": fullLaborIns,
    "sex": v(["性別(男性は1、女性は3と入力)", "性別"]),
    "Date_of_birth,Japanese_era": v(["生年月日の和暦(昭和は5, 平成は7, 令和は9と数字のみ入力)", "生年月日の和暦"]),
    "date_of_birth": birthYmd.padded6,
    "Date_of_injury,Japanese_era": "9",
    "Date_of_injury": injuryYmd.padded6,
    "Name_in_Katakana": nameInKatakana,
    "worker_name": workerName,
    "age": toHalfWidth(v(["年齢(数字のみ)", "年齢"])),

    "zip_first": workerZip.first,
    "zip_last": workerZip.last,

    "Personal_address_and_prefecture,and_phonetic_spelling": prefKana,
    "Personal_address_and_prefecture": prefStr,
    "Personal_address_in_kana": addressInKana,
    "Personal_address": cityStr,
    "Job_type": v(["職種"]),

    "time_am": isAM ? "〇" : "",
    "time_pm": isPM ? "〇" : "",
    "disaster_hour": disasterHour,
    "disaster_minute": disasterMinute,

    "accident_detail": v(["災害の原因と発生状況(詳しく)", "災害の原因と発生状況"]),

    "Title_of_the_person_verifying_the_facts": v(["災害事実の確認者職名"]),
    "Name_of_the_person_who_confirmed_the_facts": v(["災害事実の確認者氏名"]),

    "Hospital_name": hospName,
    "Hospital_Address": hospAddress,
    "Hospital_tel_area": hospPhone.area,
    "Hospital_tel_city": hospPhone.city,
    "Hospital_tel_num": hospPhone.num,
    "Hospital_zip_first": hospZip.first,
    "Hospital_zip_last": hospZip.last,
    "Claim_Hospital_name": wrapText(cleanClaimHospName, 7),

    "Location_and_condition_of_the_injury": wrapText(v(["傷病の部位及び状態"]), 25),

    "Company_Name": v(["証明会社名(事業の名称)", "証明会社名"]),
    "Company_Address": wrapText(v(["証明会社住所(事業場の所在地)", "証明会社住所"]), 28),
    "Representative's_name": v(["代表者職氏名(例: 代表取締役 山田 太郎)", "代表者職氏名"]),

    "Year_of_proof_of_fact": proofDateYmd.yearWithEra,
    "Month_of_Proof_of_Fact": proofDateYmd.month,
    "The_day_of_proof_of_facts": proofDateYmd.day,

    "Company_tel_area": compPhone.area,
    "Company_tel_city": compPhone.city,
    "Company_tel_num": compPhone.num,

    "Company_zip_first": compZip.first,
    "Company_zip_last": compZip.last,

    "Company_name_and_representative's_name": v(["所属事業場の名称・所在地"]),
    "The_person's_affiliated_company_tel_area": affCompPhone.area,
    "The_person's_affiliated_company_tel_city": affCompPhone.city,
    "The_person's_affiliated_company_tel_num": affCompPhone.num,

    "Area_of_the_Labor_Standards_Inspection_Office": inspectorateOffice,
    "claimant_zip_first": workerZip.first,
    "claimant_zip_last": workerZip.last,
    "Claimant's_address": fullAddress,
    "Claimant's_name": workerName,
    "claimant_tel_area": workerPhone.area,
    "claimant_tel_city": workerPhone.city,
    "claimant_tel_num": workerPhone.num,

    "Year_of_entry": fillDateYmd.yearWithEra,
    "Month_of_entry": fillDateYmd.month,
    "Date_of_entry": fillDateYmd.day,

    "Multiple": multipleRaw === "有" ? "〇" : "",
    "Number_of_workplaces": toHalfWidth(v(["表面以外の就業先の数(数字のみ)", "表面以外の就業先の数"])),
    "Special_Insurance_num": v(["特別加入の労働保険番号"]),
    "Name_of_Special_Member_Organization": v(["労働保険事務組合等の名称"]),

    "Year_of_joining": joiningDateYmd.yearWithEra,
    "Joining_Month": joiningDateYmd.month,
    "Joining_date": joiningDateYmd.day,
  };
}
