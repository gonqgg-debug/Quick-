import { CatalogExperience } from "@/components/catalog/CatalogExperience";
import type { CatalogCollectionRail } from "@/lib/catalog-collections-shared";
import type { CatalogRecommendations } from "@/lib/catalog-recommendations";
import type { CatalogCategoryChip } from "@/lib/catalog-products-shared";
import type { CatalogCustomer } from "@/lib/customers";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

const products: Product[] = [
  {
    id: "p-leche",
    nombre: "Leche entera 1L",
    marca: "Rica",
    descripcion: "Leche fresca para el desayuno",
    precio: 89,
    foto_url: null,
    categoria: "Lácteos y derivados",
  },
  {
    id: "p-yogurt",
    nombre: "Yogurt natural 1kg",
    marca: "Yoplait",
    descripcion: "Para el desayuno o merienda",
    precio: 145,
    foto_url: null,
    categoria: "Lácteos y derivados",
  },
  {
    id: "p-cereal",
    nombre: "Cereal de maíz 500g",
    marca: "Kellogg's",
    descripcion: "Caja familiar",
    precio: 210,
    foto_url: null,
    categoria: "Cereales y desayunos",
  },
  {
    id: "p-chips",
    nombre: "Chips de papa 150g",
    marca: "Frito Lay",
    descripcion: "Bolsa para picar",
    precio: 75,
    foto_url: null,
    categoria: "Snacks y dulces",
  },
  {
    id: "p-galleta",
    nombre: "Galletas de chocolate",
    marca: "Oreo",
    descripcion: "Paquete familiar",
    precio: 95,
    foto_url: null,
    categoria: "Snacks y dulces",
  },
  {
    id: "p-agua",
    nombre: "Agua 6 pack",
    marca: "Dasani",
    descripcion: "Botellas 600ml",
    precio: 180,
    foto_url: null,
    categoria: "Bebidas",
  },
  {
    id: "p-coca",
    nombre: "Refresco 2L",
    marca: "Coca-Cola",
    descripcion: "Botella familiar",
    precio: 120,
    foto_url: null,
    categoria: "Bebidas",
  },
  {
    id: "p-manzana",
    nombre: "Manzana roja",
    marca: null,
    descripcion: "Por libra",
    precio: 65,
    foto_url: null,
    categoria: "Frutas",
  },
  {
    id: "p-platano",
    nombre: "Plátano maduro",
    marca: null,
    descripcion: "Unidad",
    precio: 25,
    foto_url: null,
    categoria: "Frutas",
  },
  {
    id: "p-arroz",
    nombre: "Arroz premium 5lb",
    marca: "Goya",
    descripcion: "Grano largo",
    precio: 195,
    foto_url: null,
    categoria: "Almacén",
  },
  {
    id: "p-aceite",
    nombre: "Aceite de soya 1L",
    marca: "Crisol",
    descripcion: "Para cocinar",
    precio: 160,
    foto_url: null,
    categoria: "Almacén",
  },
  {
    id: "p-vitamina",
    nombre: "Vitamina C 500mg",
    marca: "Nature Made",
    descripcion: "Frasco 60 tabletas",
    precio: 350,
    foto_url: null,
    categoria: "Farmacia",
  },
  {
    id: "p-nuevo",
    nombre: "Granola crunch 400g",
    marca: "Quaker",
    descripcion: "Recién llegada",
    precio: 230,
    foto_url: null,
    categoria: "Cereales y desayunos",
  },
];

const categories: CatalogCategoryChip[] = [
  { name: "Almacén", count: 2 },
  { name: "Bebidas", count: 2 },
  { name: "Cereales y desayunos", count: 2 },
  { name: "Frutas", count: 2 },
  { name: "Lácteos y derivados", count: 2 },
  { name: "Snacks y dulces", count: 2 },
  { name: "Farmacia", count: 1 },
];

const byId = Object.fromEntries(products.map((product) => [product.id, product]));

const recommendations: CatalogRecommendations = {
  bestSellers: [byId["p-agua"], byId["p-arroz"], byId["p-coca"], byId["p-leche"]],
  lastOrder: {
    orderId: "preview-order",
    createdAt: new Date().toISOString(),
    items: [
      { productId: "p-leche", nombre: "Leche entera 1L", cantidad: 2, available: true },
      { productId: "p-pan", nombre: "Pan de agua", cantidad: 1, available: false },
    ],
    products: [byId["p-leche"]],
  },
  favorites: [byId["p-leche"], byId["p-chips"], byId["p-agua"]],
};

const collections: CatalogCollectionRail[] = [
  {
    id: "desayuno",
    title: "Para el desayuno",
    subtitle: "Lácteos, cereales y lo esencial para arrancar",
    match: { kind: "categories", categoryKeys: ["lacteos", "cereales y desayunos"] },
    categoryNames: ["Lácteos y derivados", "Cereales y desayunos"],
    products: [byId["p-leche"], byId["p-yogurt"], byId["p-cereal"]],
  },
  {
    id: "picar",
    title: "Para picar",
    subtitle: "Snacks y antojos del residencial",
    match: { kind: "categories", categoryKeys: ["snacks y dulces"] },
    categoryNames: ["Snacks y dulces"],
    products: [byId["p-chips"], byId["p-galleta"]],
  },
  {
    id: "nuevos",
    title: "Recién llegados",
    subtitle: "Lo último que sumamos al minimarket",
    match: { kind: "recency" },
    categoryNames: [],
    products: [byId["p-nuevo"], byId["p-cereal"]],
  },
];

const customer: CatalogCustomer = {
  id: "preview-customer",
  nombre: "Ana",
  apellido: "Pérez",
  phoneNumber: "18090000000",
  addresses: [
    {
      id: "addr-1",
      direccion: "Jardines III, Edif. 3, Apto 201",
      etiqueta: "Casa",
      esPredeterminada: true,
      residencial: "Jardines III",
      edificio: "3",
      apartamento: "201",
    },
  ],
};

export default function CatalogPreviewPage() {
  return (
    <CatalogExperience
      sessionId="preview"
      categories={categories}
      customer={customer}
      recommendations={recommendations}
      collections={collections}
      localProducts={products}
    />
  );
}
