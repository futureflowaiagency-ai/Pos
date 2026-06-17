import { Router } from 'express';
import { getEmployees, getEmployee, createEmployee, updateEmployee, setEmployeeStatus, deleteEmployee, paySalary } from '../controllers/employeeController.js';
import { protect } from '../middleware/auth.js';
import { requireBusiness } from '../middleware/tenant.js';
import { authorize } from '../middleware/role.js';

const router = Router();
router.use(protect, requireBusiness);

// Only the shop owner (or platform superadmin) may manage employees.
const ownerOnly = authorize('owner', 'superadmin');

router.route('/')
  .get(getEmployees)
  .post(ownerOnly, createEmployee);
router.route('/:id')
  .get(getEmployee)
  .put(ownerOnly, updateEmployee)
  .delete(ownerOnly, deleteEmployee);
router.patch('/:id/status', ownerOnly, setEmployeeStatus);
router.post('/:id/salary', ownerOnly, paySalary);
export default router;
