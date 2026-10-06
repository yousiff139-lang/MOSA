const bcrypt = require('bcryptjs');
const hash = '$2b$10$mCTMLvygWIJ6JrHpguUqGuzss091jsB4ueySghDwjQ9i5sKgYYRXC';
Promise.all([
  bcrypt.compare('1234', hash).then(r => console.log('1234:', r)),
  bcrypt.compare('123456', hash).then(r => console.log('123456:', r)),
  bcrypt.compare('admin', hash).then(r => console.log('admin:', r)),
  bcrypt.compare('12345', hash).then(r => console.log('12345:', r)),
  bcrypt.compare('112233', hash).then(r => console.log('112233:', r)),
  bcrypt.compare('0000', hash).then(r => console.log('0000:', r))
]).catch(e => {
  const bcryptjs = require('bcryptjs');
  Promise.all([
    bcryptjs.compare('1234', hash).then(r => console.log('1234:', r)),
    bcryptjs.compare('123456', hash).then(r => console.log('123456:', r)),
    bcryptjs.compare('admin', hash).then(r => console.log('admin:', r)),
    bcryptjs.compare('12345', hash).then(r => console.log('12345:', r))
  ]);
});
