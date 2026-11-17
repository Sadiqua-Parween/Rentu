export const seedDatabase = async () => {
  console.log('Seed database called: Demo seed data is permanently disabled to ensure only authentic user data is maintained.');
};

if (require.main === module) {
  seedDatabase();
}
