# 様式第5号

## 被災労働者

worker_name
### worker_name

入力形式

familyName
givenName

例

familyName = 織田
givenName = 信長

出力

織田　信長

※姓と名の間は全角スペース

worker_kana
gender

入力:
male

出力:
1

birth_date
postal_code
address

## 事業場

labor_insurance_number
company_name
company_address
company_phone

## 災害

injury_date
### injury_time

入力形式

injury_ampm

値:
AM
PM

injury_hour

値:
1～12

injury_minute

値:
0～59

例

午後10:30

↓

injury_ampm = pm
injury_hour = 10
injury_minute = 30

出力形式

午後に◯

10 時

30 分

injury_place
injury_description

## 医療機関

hospital_name
hospital_address

## 事業主

employer_name
employer_address

