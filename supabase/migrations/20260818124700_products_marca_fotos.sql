alter table public.products
  add column if not exists marca text;

update public.products set marca = 'Capullo', descripcion = 'Aceite de girasol 1,5 L, ideal para freír y ensaladas.', foto_url = 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&h=600&fit=crop&q=80' where nombre = 'Aceite girasol';
update public.products set marca = 'Ina', descripcion = 'Spaghetti de sémola 500 g. Cocción al dente en 8 minutos.', foto_url = 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&h=600&fit=crop&q=80' where nombre = 'Fideos spaghetti';
update public.products set marca = 'Avícola', descripcion = 'Maple de 12 huevos frescos, tamaño jumbo.', foto_url = 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=600&h=600&fit=crop&q=80' where nombre = 'Huevos';
update public.products set marca = 'Rica', descripcion = 'Leche entera UHT 1 litro, lista para tomar.', foto_url = 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&h=600&fit=crop&q=80' where nombre = 'Leche entera';
update public.products set marca = 'Presidente', descripcion = 'Queso cremoso fresco, porción de 200 g.', foto_url = 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=600&h=600&fit=crop&q=80' where nombre = 'Queso cremoso';
update public.products set marca = 'Cristal', descripcion = 'Pack de 6 botellas de agua sin gas, 600 ml c/u.', foto_url = 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=600&h=600&fit=crop&q=80' where nombre = 'Agua sin gas';
update public.products set marca = 'Del Campo', descripcion = 'Banana madura al punto, precio por kilo.', foto_url = 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&h=600&fit=crop&q=80' where nombre = 'Banana';
update public.products set marca = 'Del Campo', descripcion = 'Manzana roja crujiente, precio por kilo.', foto_url = 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&h=600&fit=crop&q=80' where nombre = 'Manzana roja';
update public.products set marca = 'Del Campo', descripcion = 'Naranja para jugo, malla de 1 kg.', foto_url = 'https://images.unsplash.com/photo-1547514701-4278210176e7?w=600&h=600&fit=crop&q=80' where nombre = 'Naranja jugo';
update public.products set marca = 'Del Campo', descripcion = 'Tomate perita maduro, precio por kilo.', foto_url = 'https://images.unsplash.com/photo-1546470427-e5ac89c0ba71?w=600&h=600&fit=crop&q=80' where nombre = 'Tomate';
update public.products set marca = 'Del Campo', descripcion = 'Lechuga criolla fresca, unidad.', foto_url = 'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=600&h=600&fit=crop&q=80' where nombre = 'Lechuga criolla';
update public.products set marca = 'Del Campo', descripcion = 'Papa blanca para guisar o freír, precio por kilo.', foto_url = 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&h=600&fit=crop&q=80' where nombre = 'Papa';
update public.products set marca = 'MK', descripcion = 'Paracetamol 500 mg, caja con 20 tabletas.', foto_url = 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&h=600&fit=crop&q=80' where nombre = 'Paracetamol 500 mg';
update public.products set marca = 'Pedialyte', descripcion = 'Suero oral en sobre de 20.5 g para rehidratación.', foto_url = 'https://images.unsplash.com/photo-1550572017-edd951b55104?w=600&h=600&fit=crop&q=80' where nombre = 'Suero oral';
