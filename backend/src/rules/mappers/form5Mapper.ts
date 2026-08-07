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
  fillAllForTest: boolean = false
): Record<string, string> {
  // 1. 各種ルール関数の適用・データ切り出し
  const workerZip = splitPostalCode(rawInput["本人郵便番号(例: 123-4567)"] || rawInput["本人郵便番号"] || (fillAllForTest ? "611-0002" : ""));
  const hospZip = splitPostalCode(rawInput["診療を受けた病院郵便番号(例: 100-0001)"] || rawInput["病院郵便番号"] || (fillAllForTest ? "639-2101" : ""));
  const compZip = splitPostalCode(rawInput["会社郵便番号"] || rawInput["事業場郵便番号"] || (fillAllForTest ? "604-8130" : ""));

  const workerPhone = splitPhoneNumber(rawInput["本人電話番号(例: 090-1234-5678)"] || rawInput["本人電話番号"] || (fillAllForTest ? "080-1458-7000" : ""));
  const hospPhone = splitPhoneNumber(rawInput["病院電話番号(例: 03-1234-5678)"] || rawInput["病院電話番号"] || (fillAllForTest ? "0745-69-2101" : ""));
  const compPhone = splitPhoneNumber(rawInput["会社電話番号"] || rawInput["事業場電話番号"] || (fillAllForTest ? "075-221-8800" : ""));

  // 本人と所属会社が異なる場合の「その会社の電話番号」の分割処理
  const affCompPhone = splitPhoneNumber(
    rawInput["その会社の電話番号"] || rawInput["所属会社電話番号"] || rawInput["本人所属会社電話番号"] || (fillAllForTest ? "075-221-8800" : "")
  );

  const birthYmd = parseYYMMDD(rawInput["生年月日(例: 55年5月15日→550515)"] || rawInput["生年月日"] || (fillAllForTest ? "480219" : ""));
  const injuryYmd = parseYYMMDD(rawInput["負傷年月日(例: 令和8年8月29日→080829)"] || rawInput["負傷年月日"] || (fillAllForTest ? "080722" : ""));
  const fillDateYmd = parseJapaneseDate(rawInput["記入日(例: 令和8年8月30日)"] || rawInput["記入日"] || (fillAllForTest ? "令和8年7月29日" : ""));

  const timeInfo = parseInjuryTime(
    rawInput["負傷時刻区分(AM または PM)"] || rawInput["負傷時刻区分"] || (fillAllForTest ? "PM" : ""),
    rawInput["負傷時刻(時)"] || rawInput["負傷時刻時"] || (fillAllForTest ? "2" : ""),
    rawInput["負傷時刻(分)"] || rawInput["負傷時刻分"] || (fillAllForTest ? "55" : "")
  );

  const laborIns = parseLaborInsurance(rawInput["特別加入の労働保険番号"] || rawInput["労働保険番号"] || (fillAllForTest ? "2910123456789" : ""));
  const hospNameCleaned = trimFacilitySuffix(rawInput["診療を受けた病院名"] || rawInput["病院名"] || (fillAllForTest ? "吉本整形外科・外科病院" : ""));

  const prefStr = rawInput["住所都道府県"] || rawInput["都道府県"] || (fillAllForTest ? "京都府" : "");
  const cityStr = rawInput["住所市町村以降"] || rawInput["市区町村以降"] || (fillAllForTest ? "宇治市木幡御蔵山３９番地９２３号" : "");
  const fullAddress = prefStr + cityStr;
  const workerName = rawInput["氏名(漢字)"] || rawInput["氏名"] || rawInput["労働者氏名"] || (fillAllForTest ? "松井 浩愛" : "");

  // 会社情報
  const compName = rawInput["会社名"] || rawInput["事業場名称"] || (fillAllForTest ? "株式会社テスト地質コンサルタント" : "");
  const compAddr = rawInput["会社住所"] || rawInput["事業場所在地"] || (fillAllForTest ? "京都府京都市中京区烏丸通六角下ル七観音町640" : "");
  const repName = rawInput["代表者名"] || rawInput["事業主氏名"] || (fillAllForTest ? "代表取締役 山田 太郎" : "");
  const affCompNameRep = rawInput["Company_name_and_representative's_name"] || rawInput["本人所属会社(上記と異なる場合)"] || rawInput["所属会社名及び代表者氏名"] || (fillAllForTest ? "株式会社テスト地質コンサルタント 代表取締役 山田 太郎" : "");

  // 2. form5.json の各 id に完全に合致するオブジェクトを生成
  return {
    // --- Page 1 (front) ---
    "Labor_insurance_No.": laborIns.full,
    "sex": rawInput["性別(男性は1、女性は3)"] || rawInput["性別"] || (fillAllForTest ? "1" : ""),
    "Date_of_birth,Japanese_era": rawInput["生年月日の和暦(昭和5, 平成7, 令和9)"] || rawInput["生年月日和暦"] || (fillAllForTest ? "5" : ""),
    "date_of_birth": birthYmd.year + birthYmd.month + birthYmd.day,
    "Date_of_injury,Japanese_era": "9", // 令和
    "Date_of_injury": injuryYmd.year + injuryYmd.month + injuryYmd.day,
    "Name_in_Katakana": truncateKana(rawInput["氏名フリガナ(全角カタカナ・姓と名の間にスペース)"] || rawInput["氏名フリガナ"] || (fillAllForTest ? "マツイ ヒロヨシ" : ""), 12),
    "worker_name": workerName,
    "age": rawInput["年齢(数字のみ)"] || rawInput["年齢"] || (fillAllForTest ? "53" : ""),
    "zip_first": workerZip.first,
    "zip_last": workerZip.last,
    "Personal_address_and_prefecture,and_phonetic_spelling": rawInput["住所都道府県フリガナ"] || (fillAllForTest ? "キョウトフ" : ""),
    "Personal_address_and_prefecture": prefStr,
    "Personal_address_in_kana": rawInput["住所市町村以降フリガナ"] || (fillAllForTest ? "ウジシコハタオクラヤマ" : ""),
    "Personal_address": cityStr,
    "Job_type": rawInput["職種"] || (fillAllForTest ? "地質調査現場作業員" : ""),
    "time_am": timeInfo.amMark,
    "time_pm": timeInfo.pmMark,
    "disaster_hour": timeInfo.hour,
    "disaster_minute": timeInfo.minute,
    "Title_of_the_person_verifying_the_facts": rawInput["事実確認者の職名"] || (fillAllForTest ? "現場責任者" : ""),
    "Name_of_the_person_who_confirmed_the_facts": rawInput["事実確認者の氏名"] || (fillAllForTest ? "佐藤 健二" : ""),
    "accident_detail": rawInput["災害の原因と発生状況"] || rawInput["災害の原因及び発生状況"] || (fillAllForTest ? "地質調査のため、ボーリング作業の貫入試験後、被災者がロッド切り離し作業を行った際、パイプレンチの取り外しが終わっていないことをマシン操作員が確認せず、スピンドルの引き上げ操作を行ったため、本体とパイプレンチに右手中指が挟まり負傷。" : ""),
    "Hospital_name": hospNameCleaned,
    "Hospital_Address": rawInput["診療を受けた病院住所"] || rawInput["病院住所"] || (fillAllForTest ? "奈良県葛城市疋田676-1" : ""),
    "Hospital_tel_area": hospPhone.area,
    "Hospital_tel_city": hospPhone.city,
    "Hospital_tel_num": hospPhone.num,
    "Hospital_zip_first": hospZip.first,
    "Hospital_zip_last": hospZip.last,
    "Location_and_condition_of_the_injury": rawInput["傷病の部位及び状態"] || rawInput["傷病部位"] || (fillAllForTest ? "右手中指裂傷および不全切断" : ""),
    
    // 会社関連情報
    "Company_Name": compName,
    "Company_Address": compAddr,
    "Representative's_name": repName,
    "Year_of_proof_of_fact": fillDateYmd.year,
    "Month_of_Proof_of_Fact": fillDateYmd.month,
    "The_day_of_proof_of_facts": fillDateYmd.day,
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

    "Area_of​_the_Labor_Standards_Inspection_Office": rawInput["所轄労働基準監督署"] || (fillAllForTest ? "京都南" : ""),
    "Claim_Hospital_name": hospNameCleaned,
    "claimant_zip_first": workerZip.first,
    "claimant_zip_last": workerZip.last,
    "Claimant's_address": fullAddress,
    "Claimant's_name": workerName,
    "Year_of_entry": fillDateYmd.year,
    "Month_of_entry": fillDateYmd.month,
    "Date_of_entry": fillDateYmd.day,
    "claimant_tel_area": workerPhone.area,
    "claimant_tel_city": workerPhone.city,
    "claimant_tel_num": workerPhone.num,

    // --- Page 2 (back) ---
    "Multiple": rawInput["その他就業先が有る場合(有と入力、無ければ空欄)"] || (fillAllForTest ? "無" : ""),
    "Number_of_workplaces": rawInput["表面以外の就業先の数(数字のみ)"] || (fillAllForTest ? "1" : ""),
    "Special_Insurance_num": laborIns.full,
    "Name_of_Special_Member_Organization": rawInput["労働保険事務組合等の名称"] || (fillAllForTest ? "全日本地質調査業労働保険事務組合連合会" : ""),
    "Year_of_joining": fillAllForTest ? "05" : "",
    "Joining_Month": fillAllForTest ? "04" : "",
    "Joining_date": fillAllForTest ? "01" : ""
  };
}