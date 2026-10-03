export const IMAGES = {
  hero: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCF7KnnRayvoeJjr9ir61sfoOJh-xT4anqsFReGrouaT2hgYhxaspH-0JOi4l6xpWYm4M6-scPpjvaHNA8LhobAb1RumSRueg_G3gOzPIkBRL_SRqwILqsfGfLipEqmm-CoHoeeB8IRGpSGZaDKIlLwKR8yyilszd59V3Vr3-B9iwmgCyWhsqJhlyeSKAEh88fpu6IsKuxcKFwo4I_Dxottf5k08Ul_GHHmm7ENK8gRyFpuj3eZPX0IZA',
  pempek: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBMzwlLwca537HUXoonYu1eMEyz607-0PLLdfqOIJoe9LT6rL1sMJHLLHYkC95KC4NI-8cJRtgltbEohQYb4BBxPhUTCvOXBun2Gxrz4MseVoTaOhP6jip6j_STWPXlPiY_PCbKhzbBw3MBiLSn19iEFCM1nXWXnou9HwRDGFOGCt97TLA0Szv3xgcpeWVY39v9wgYrNb0qy1zbmP1zLoZVhowoCVIUaelYlOh-uPQSHdc-dXXkMK8Y7w',
  productHero: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBOGeEbZhh0-K2cYoWeWjtB2v9UZ7oELRPJORAICApCna4x5HJCW2LFDPRcw5wrOgd-7SpVN8y-a_Cj0Fkvw9xEtVuYEuGMD7MtanZ-dNTqspK12EVWFTkWgYRNPdvGkzWcjST5DwrxU_PVetu1DfaZ5zj6QnJkq-UpEqhibfT-UTQ4r_nWFMUK1DWx-TUCdeKPRKmgBc4vos3x-i2qBLkjga_hsE1CifUWzBMdsp7XG1zOGorE6Q_j1g',
  tekwan: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBhdmnoL7cnp7ya4uBBgtrCM_4-7QoWejtscyP9JjuFOt7M3YdJgtxY7Txh4zqpTjhWe_3gxHfblZRzsSAIp6iY4a750cvApoWP39gc4bFJcjSi6oeK0TM4TT0ckhwYuiYIlyI4Pz_3Fobqef0hypm6RzbTbVLdvQLN81Heux2a-xRNdETYowCSoAVhShS0mc2il4AP29NdnSxXMQHvWY85saihXnZVbej4DAXp6G4IyJ3dlBTj-0dKLQ',
  kerupuk: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDUlWa6D3TcE1nd5TJeUYT38XxthmK5AeGB2iYS9j7Y3YrtIQm_z3SZiW8UT1dp11x61iKOWPtrtGKEaclfpyxW-AShms4QxSIF1ydWhQVCF2QPhyAxJK5j3rIFhjEpDOQNug-h7yDXsJbCx9GmYYNe5_x833T60cCs5SWOaRJN3T9OAAFtURCk2V-4BnhMcMdxyRXTphXnx9a8IQ4QFMR0p5R_eMTkei7kn5hetl3Mhk-wWlKM3YQafA',
  kacang: 'https://lh3.googleusercontent.com/aida-public/AB6AXuArix709NOJ4txRMg8jwTLIHD64FP0Db9RcQWeewy0gd6Tm24Pox7WIi6K8KpsuR8HWU0FHydYnWVm8EBnouDMxLbttczjjOAxvqena2mWTKUEFk4deXcQW_Re3p6twMMs3mURO55_Hg3IgZdvpv0U042umY0jTUGm0PxI329PFMUbehWuXMWSOvCdytl-HvYYcnwWJGbacqwwEzZztIc5fZEucBNi1D-TaME751mtoWGIS6EjBDiUEgA',
  driver: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC8JL3rXENrZ0fkKJJ7GfnC5JwFrZ7Seag6fy67XI6XfiAndkIoeAAragtvelTbrE5v5uAsfFkjxfAZwdv6ydZm6mKOZpunBQRlyXZkgOhfKCjjafNUS2Zby6BUzi0PG_5KgICeJTNfgF6i3-jEvlkZ2GFZHhpmAxZDxnepBWreT5ZtYhJVin_VNght7BRww8kbAuVcjrNZ7iqW8VavM-R_vwaa9RXYU-5U9rymR-hNktAuKx8ds_sytg',
};

export type ProductCategory = 'Makanan' | 'Minuman' | 'Camilan' | 'Oleh-oleh';

export const products = [
  { id: '1', name: 'Kapal Selam', merchant: 'Pempek Sari', price: 25000, image: IMAGES.pempek, category: 'Makanan' },
  { id: '2', name: 'Tekwan Kuah', merchant: 'Dapur Mami', price: 20000, image: IMAGES.tekwan, category: 'Makanan' },
  { id: '3', name: 'Pempek Kulit', merchant: 'Rasa Palembang', price: 18000, image: IMAGES.kerupuk, category: 'Camilan' },
  { id: '4', name: 'Es Kacang Merah', merchant: 'Kedai Sejahtera', price: 12000, image: IMAGES.kacang, category: 'Minuman' },
  { id: '5', name: 'Kerupuk Ikan Palembang', merchant: 'Kerupuk Ikan 212', price: 30000, image: IMAGES.kerupuk, category: 'Oleh-oleh' },
] satisfies Array<{
  id: string;
  name: string;
  merchant: string;
  price: number;
  image: string;
  category: ProductCategory;
}>;

export const merchants = [
  { id: '1', name: 'Pempek Sari', city: 'Palembang', rating: '4.8', reviews: '120+', distance: '1.2 km', image: IMAGES.hero },
  { id: '2', name: 'Tekwan Lezat', city: 'Palembang', rating: '4.6', reviews: '86', distance: '2.1 km', image: IMAGES.tekwan },
  { id: '3', name: 'Kerupuk Ikan 212', city: 'Palembang', rating: '4.7', reviews: '54', distance: '3.4 km', image: IMAGES.kerupuk },
  { id: '4', name: 'Pempek & Cuko', city: 'Palembang', rating: '4.5', reviews: '72', distance: '3.8 km', image: IMAGES.pempek },
];

export const cartItems = [
  { id: '1', name: 'Pempek Kapal Selam', merchant: 'Pempek Sari', price: 25000, image: IMAGES.pempek },
  { id: '2', name: 'Tekwan', merchant: 'Dapur Mami', price: 20000, image: IMAGES.tekwan },
  { id: '3', name: 'Kerupuk Ikan', merchant: 'Rasa Palembang', price: 15000, image: IMAGES.kerupuk },
  { id: '4', name: 'Es Kacang Merah', merchant: 'Kedai Sejahtera', price: 12000, image: IMAGES.kacang },
];

export const rupiah = (value: number) => `Rp ${value.toLocaleString('id-ID')}`;
