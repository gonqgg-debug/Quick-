-- Datos de prueba para el catálogo.
-- Correr después de la migración, en el SQL Editor de Supabase.

insert into public.chats (id, phone_number, nombre)
values (
  '11111111-1111-4111-8111-111111111111',
  '+5491100000000',
  'Cliente demo'
)
on conflict (phone_number) do nothing;

insert into public.products (nombre, marca, descripcion, precio, foto_url, categoria, activo)
values
  ('Banana', 'Del Campo', 'Banana madura al punto, precio por kilo.', 1890, 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&h=600&fit=crop&q=80', 'Frutas', true),
  ('Manzana roja', 'Del Campo', 'Manzana roja crujiente, precio por kilo.', 2490, 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&h=600&fit=crop&q=80', 'Frutas', true),
  ('Naranja jugo', 'Del Campo', 'Naranja para jugo, malla de 1 kg.', 2190, 'https://images.unsplash.com/photo-1547514701-4278210176e7?w=600&h=600&fit=crop&q=80', 'Frutas', true),
  ('Tomate', 'Del Campo', 'Tomate perita maduro, precio por kilo.', 2690, 'https://images.unsplash.com/photo-1546470427-e5ac89c0ba71?w=600&h=600&fit=crop&q=80', 'Verduras', true),
  ('Lechuga criolla', 'Del Campo', 'Lechuga criolla fresca, unidad.', 990, 'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=600&h=600&fit=crop&q=80', 'Verduras', true),
  ('Papa', 'Del Campo', 'Papa blanca para guisar o freír, precio por kilo.', 1290, 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&h=600&fit=crop&q=80', 'Verduras', true),
  ('Huevos', 'Avícola', 'Maple de 12 huevos frescos, tamaño jumbo.', 3290, 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=600&h=600&fit=crop&q=80', 'Almacén', true),
  ('Aceite girasol', 'Capullo', 'Aceite de girasol 1,5 L, ideal para freír y ensaladas.', 4590, 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&h=600&fit=crop&q=80', 'Almacén', true),
  ('Fideos spaghetti', 'Ina', 'Spaghetti de sémola 500 g. Cocción al dente en 8 minutos.', 1590, 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&h=600&fit=crop&q=80', 'Almacén', true),
  ('Leche entera', 'Rica', 'Leche entera UHT 1 litro, lista para tomar.', 1490, 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&h=600&fit=crop&q=80', 'Lácteos', true),
  ('Queso cremoso', 'Presidente', 'Queso cremoso fresco, porción de 200 g.', 2790, 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=600&h=600&fit=crop&q=80', 'Lácteos', true),
  ('Agua sin gas', 'Cristal', 'Pack de 6 botellas de agua sin gas, 600 ml c/u.', 3990, 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=600&h=600&fit=crop&q=80', 'Bebidas', true),
  ('Paracetamol 500 mg', 'MK', 'Paracetamol 500 mg, caja con 20 tabletas.', 189, 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&h=600&fit=crop&q=80', 'Farmacia', true),
  ('Suero oral', 'Pedialyte', 'Suero oral en sobre de 20.5 g para rehidratación.', 95, 'https://images.unsplash.com/photo-1550572017-edd951b55104?w=600&h=600&fit=crop&q=80', 'Farmacia', true);

insert into public.order_sessions (id, chat_id, expira_en, estado)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  now() + interval '24 hours',
  'activa'
)
on conflict (id) do update
set
  estado = 'activa',
  expira_en = now() + interval '24 hours';
