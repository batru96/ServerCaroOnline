$('document').ready(() => {
    let dsOnline;

    $('#formDangNhap').show();
    $('#formDangXuat').hide();

    const socket = io('http://localhost:3000');
    socket.on('SERVER_SEND_DANG_NHAP_THAT_BAI', data => onDangNhapThatBai(data));
    socket.on('SERVER_SEND_DANG_NHAP_THANH_CONG', data => onDangNhapThanhCong(data));
    socket.on('SERVER_SEND_DS_USERS_ONLINE', ds => onReceiveDsUser(ds));

    function onDangNhapThatBai(data) {
        alert('Đăng nhập thất baị!');
    }

    function onReceiveDsUser(ds) {
        console.log(ds);
    }

    function onDangNhapThanhCong(data) {
        alert('Dang nhap thanh cong');
        $('#formDangNhap').hide();
        $('#formDangXuat').show();
        console.log(data);
    }

    $('#btnDangNhap').click(() => {
        const email = $('#edtEmail').val();
        const password = $('#edtPassword').val();
        socket.emit('USER_SEND_DANG_NHAP', { email, password });
    });

    $('#btnDangXuat').click(() => {
        socket.emit('USER_SEND_DANG_XUAT');
        $('#formDangNhap').show();
        $('#formDangXuat').hide();
    });

    $('#btnThem').click(() => {
        const item = '<li>New item</li>';
        $('#lvUser').append(item);
    });
});