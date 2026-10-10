-- Assinatura: duração do plano (não 30d fixos) + renovação empilha dias.
-- NULL premium_expires_at = vitalício (SuperAdmin). Job de aplicação marca premium_expired.

CREATE OR REPLACE FUNCTION activate_paid_transaction()
RETURNS TRIGGER AS $$
DECLARE
  pack_hours INT;
  item RECORD;
  plan_days INT;
BEGIN
  IF NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM 'pago') THEN
    NEW.paid_at = COALESCE(NEW.paid_at, NOW());

    IF NEW.type = 'subscription' THEN
      SELECT COALESCE(
        CASE lower(COALESCE(period, 'month'))
          WHEN 'year' THEN 365
          WHEN 'annual' THEN 365
          WHEN 'ano' THEN 365
          WHEN 'week' THEN 7
          WHEN 'semana' THEN 7
          WHEN 'day' THEN 1
          WHEN 'dia' THEN 1
          ELSE 30
        END,
        30
      )
      INTO plan_days
      FROM subscription_plans
      WHERE id = 'premium' AND is_active = TRUE
      LIMIT 1;

      plan_days := COALESCE(plan_days, 30);

      UPDATE users
      SET subscription_status = 'premium_active',
          premium_expires_at = GREATEST(COALESCE(premium_expires_at, NOW()), NOW())
            + (plan_days || ' days')::interval,
          updated_at = NOW()
      WHERE id = NEW.user_id;
    END IF;

    IF NEW.type = 'rental' AND NEW.video_id IS NOT NULL THEN
      NEW.access_expires_at = NEW.paid_at + INTERVAL '48 hours';
      INSERT INTO rentals (user_id, video_id, transaction_id, starts_at, expires_at)
      VALUES (NEW.user_id, NEW.video_id, NEW.id, NEW.paid_at, NEW.paid_at + INTERVAL '48 hours')
      ON CONFLICT (user_id, video_id)
      DO UPDATE SET
        transaction_id = EXCLUDED.transaction_id,
        starts_at = EXCLUDED.starts_at,
        expires_at = EXCLUDED.expires_at;
    END IF;

    IF NEW.type = 'pack' AND NEW.pack_id IS NOT NULL THEN
      SELECT rental_hours INTO pack_hours FROM tvod_packs WHERE id = NEW.pack_id;
      pack_hours := COALESCE(pack_hours, 48);
      NEW.access_expires_at = NEW.paid_at + (pack_hours || ' hours')::interval;

      INSERT INTO pack_entitlements (user_id, pack_id, transaction_id, starts_at, expires_at)
      VALUES (NEW.user_id, NEW.pack_id, NEW.id, NEW.paid_at, NEW.access_expires_at)
      ON CONFLICT (user_id, pack_id)
      DO UPDATE SET
        transaction_id = EXCLUDED.transaction_id,
        starts_at = EXCLUDED.starts_at,
        expires_at = EXCLUDED.expires_at;

      FOR item IN
        SELECT video_id FROM tvod_pack_items WHERE pack_id = NEW.pack_id
      LOOP
        INSERT INTO rentals (user_id, video_id, transaction_id, starts_at, expires_at)
        VALUES (NEW.user_id, item.video_id, NEW.id, NEW.paid_at, NEW.access_expires_at)
        ON CONFLICT (user_id, video_id)
        DO UPDATE SET
          transaction_id = EXCLUDED.transaction_id,
          starts_at = EXCLUDED.starts_at,
          expires_at = GREATEST(rentals.expires_at, EXCLUDED.expires_at);
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
