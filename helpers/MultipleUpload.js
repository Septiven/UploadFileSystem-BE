// Import Multer
const multer = require('multer')

const multipleUpload = () => {
    // Setting Multer
    // 1. Disk Storage
    let storage = multer.diskStorage({
        destination: function(req, file, next){
            next(null, 'images_products')
        },
        filename: function(req, file, next){
            console.log(file)
            next(null, 'PIMG' + '-' + Date.now() + '.' + file.mimetype.split('/')[1])
        }
    })

    // 2. File Filter
    function fileFilter(req, file, next){
        console.log(req.files)
        if(file.mimetype.split('/')[0] === 'image'){
            // Accept
            next(null, true)
        }else if(file.mimetype.split('/')[0] !== 'image'){
            // Reject
            next(new Error('File Must Be Image'))
        }
    }

    let multipleUpload = multer({storage: storage, fileFilter: fileFilter, limits: {fileSize: 50000000000} }).array('images', 3)

    return multipleUpload
}

module.exports = multipleUpload