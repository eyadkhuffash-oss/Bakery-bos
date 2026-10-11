// ============== نظام الأدوار والحماية ==============
// دالة التحقق من الصلاحيات
function requireRole(allowedRoles) {
  return (req, res, next) => {
    const userRole = req.get('X-User-Role') || req.query.role || 'cashier';
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'ليس لديك صلاحية' });
    }
    req.userRole = userRole;
    next();
  };
}

// الأدوار المتاحة:
// - cashier: الكاشير (إنشاء طلبيات، دفع، إدارة ديون)
// - baker: الخباز (عرض الطلبيات فقط، وضع حالة جاهز)
// - packer: التعبئة والتوصيل
// - admin: الإدارة (كل شيء)

module.exports = { requireRole };
