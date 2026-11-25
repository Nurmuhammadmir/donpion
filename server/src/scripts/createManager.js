import dotenv from "dotenv";
import connectDB from "../config/db.js";
import Branch from "../models/Branch.js";
import Manager from "../models/Manager.js";

dotenv.config();

// One-off operational script — there is no admin-side UI to create a
// Manager account (out of the manager app's stated 3-function scope, see
// the plan). Usage: node src/scripts/createManager.js "Имя" email пароль branchId
async function run() {
  const [name, email, password, branchId] = process.argv.slice(2);

  if (!name || !email || !password || !branchId) {
    console.error('Usage: node src/scripts/createManager.js "<name>" <email> <password> <branchId>');
    console.error("Find a branchId via GET /api/branches.");
    process.exit(1);
  }

  await connectDB();

  const branch = await Branch.findById(branchId);
  if (!branch) {
    console.error(`Branch not found: ${branchId}`);
    process.exit(1);
  }

  const normalizedEmail = email.toLowerCase();
  const existing = await Manager.findOne({ email: normalizedEmail });
  if (existing) {
    console.error(`A manager with this email already exists: ${normalizedEmail}`);
    process.exit(1);
  }

  const passwordHash = await Manager.hashPassword(password);
  const manager = await Manager.create({ name, email: normalizedEmail, passwordHash, branch: branch._id });

  console.log(`Manager created: ${manager.email} (branch: ${branch.name}, id: ${manager._id})`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
