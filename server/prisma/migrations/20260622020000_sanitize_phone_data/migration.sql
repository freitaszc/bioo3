UPDATE "Doctor" SET "phone" = REGEXP_REPLACE("phone", '[^0-9]', '', 'g'), "councilType" = UPPER(REGEXP_REPLACE("councilType", '[^A-Za-z-]', '', 'g')), "councilNumber" = REGEXP_REPLACE("councilNumber", '[^0-9]', '', 'g');
UPDATE "Patient" SET "phone" = REGEXP_REPLACE("phone", '[^0-9]', '', 'g');
