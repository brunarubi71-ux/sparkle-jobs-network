
-- Create a function to seed sample data for a user
CREATE OR REPLACE FUNCTION public.seed_sample_data(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only seed if no jobs exist
  IF (SELECT count(*) FROM public.jobs) > 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.jobs (owner_id, title, cleaning_type, price, bedrooms, bathrooms, address, city, latitude, longitude, urgency, status, description) VALUES
  (p_user_id, 'Deep Clean 3BR Apartment', 'residential', 180, 3, 2, '123 Oak St', 'Los Angeles', 34.0522, -118.2437, 'asap', 'open', 'Full deep clean needed for move-out. Kitchen and bathrooms need extra attention.'),
  (p_user_id, 'Airbnb Turnover - Studio', 'airbnb', 85, 1, 1, '456 Palm Ave', 'Los Angeles', 34.0195, -118.4912, 'urgent', 'open', 'Quick turnover between guests. Fresh linens provided.'),
  (p_user_id, 'Office Weekly Clean', 'commercial', 250, 0, 2, '789 Business Blvd', 'Santa Monica', 34.0259, -118.4798, 'scheduled', 'open', 'Weekly office cleaning. 2000 sqft open floor plan.'),
  (p_user_id, 'Post-Renovation Cleanup', 'residential', 320, 4, 3, '321 Elm Dr', 'Beverly Hills', 34.0736, -118.4004, 'asap', 'open', 'Heavy cleaning after kitchen renovation. Dust removal throughout.'),
  (p_user_id, 'Airbnb Luxury Villa', 'airbnb', 200, 5, 4, '555 Sunset Blvd', 'Malibu', 34.0259, -118.7798, 'urgent', 'open', 'Premium cleaning for luxury Airbnb property. White glove service.'),
  (p_user_id, 'Move-In Deep Clean', 'residential', 150, 2, 1, '999 Main St', 'Pasadena', 34.1478, -118.1445, 'scheduled', 'open', 'New tenant moving in next week. Full sanitization requested.'),
  (p_user_id, 'Restaurant Kitchen', 'commercial', 400, 0, 1, '777 Food Ct', 'Hollywood', 34.0928, -118.3287, 'urgent', 'open', 'Deep clean of commercial kitchen. Health inspection coming up.');

  -- Seed schedules
  IF (SELECT count(*) FROM public.schedules) = 0 THEN
    INSERT INTO public.schedules (owner_id, city, number_of_houses, frequency, monthly_income_estimate, asking_price, description, contact_name, phone, email) VALUES
    (p_user_id, 'Los Angeles', 12, 'weekly', 4800, 8500, 'Established route of 12 residential homes in West LA. Loyal clients for 3+ years.', 'Maria G.', '(310) 555-0101', 'maria@example.com'),
    (p_user_id, 'Santa Monica', 8, 'bi-weekly', 2400, 5000, 'Premium beachside condos. Easy access, great tippers.', 'Carlos R.', '(310) 555-0202', 'carlos@example.com'),
    (p_user_id, 'Beverly Hills', 5, 'weekly', 3500, 12000, 'High-end homes with repeat business. Premium pricing.', 'Jessica L.', '(323) 555-0303', 'jessica@example.com'),
    (p_user_id, 'Pasadena', 15, 'weekly', 5200, 9000, 'Large residential route. Mix of apartments and houses.', 'David K.', '(626) 555-0404', 'david@example.com'),
    (p_user_id, 'Malibu', 4, 'weekly', 2800, 15000, 'Exclusive beachfront properties. Premium clients only.', 'Amanda S.', '(310) 555-0505', 'amanda@example.com');
  END IF;
END;
$$;
