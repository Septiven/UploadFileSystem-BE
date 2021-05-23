const express = require('express')
const app = express()

const mySql = require('mysql')
const cors = require('cors')
app.use(cors())

// Import .env
require('dotenv').config()

// Import Multer
const multer = require('multer')
const multipleUpload = require('./helpers/MultipleUpload')()
const singleUpload = require('./helpers/SingleUpload')()

// Import DeleteFiles
const deleteFiles = require('./helpers/DeleteFiles')

const PORT = 5000

const util = require('util')
const db = mySql.createConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
})
const query = util.promisify(db.query).bind(db)

app.get('/', (req, res) => {
    res.status(200).send('UPLOAD FILE SYSTEM API')
})

app.post('/upload-product', (req, res) => {
    multipleUpload(req, res, (err) => {
        try {
            if(err) throw err
            if(req.files === undefined || req.files.length === 0) throw {message: 'File Not Found'}

            // Data Text {name: ..., brand: ..., price: ..., stock: ...}
            let data = req.body.data // req.body.key
            let dataParsed
            try {
                dataParsed = JSON.parse(data) // Merubah Data Dari Form Yang Awalnya String ---> Object
                console.log(dataParsed)
            } catch (error) {
                res.status(500).send({
                    error: true,
                    message: 'Error Parsed Data'
                })
            }

            // Get Image Path Location to Delete
            let filesPathLocation = req.files.map((value) => value.path)
            console.log(filesPathLocation)

            db.beginTransaction((err) => {
                try {
                    if(err) throw err

                    db.query('INSERT INTO products SET ?', dataParsed, (err, result) => {
                        try {
                            if(err){
                                deleteFiles(filesPathLocation)
                                
                                return db.rollback(() => {
                                    throw err
                                })
                            } 
        
                            let products_id = result.insertId 
        
                            // Case: 1 File
                            // let imagePathLocation = `http://localhost:5000/${req.files[0].path}`
        
                            // Case: > 1 File
                            let imagePathLocation = req.files.map((value) => {
                                // console.log(value.path)
                                return [
                                    `http://localhost:5000/${value.path}`, products_id
                                ]
                            })
        
                            console.log(imagePathLocation)
                            
                            // Case: 1 Data
                            // db.query('INSERT INTO products_images SET ?', {image: imagePathLocation, products_id: product_id}, (err, result))
        
                            // Case: > 1 Data
                            db.query('INSERT INTO products_image (image, products_id) VALUES ?', [imagePathLocation], (err, result) => {
                                try {
                                    if(err){
                                        deleteFiles(filesPathLocation)
                                        
                                        return db.rollback(() => {
                                            throw err
                                        })
                                    } 
            
                                    db.commit((err) => {
                                        if(err){
                                            deleteFiles(filesPathLocation)
                                        
                                            return db.rollback(() => {
                                                throw err
                                            })
                                        }

                                        res.status(200).send({
                                            error: false,
                                            message: 'Upload Image Success'
                                        })
                                    })
                                } catch (error) {
                                    res.status(500).send({
                                        error: true, 
                                        message: 'Error Insert Image',
                                        detail: error.message
                                    })
                                }
                            })
                        } catch (error) {
                            res.status(500).send({
                                error: true, 
                                message: 'Error Insert Product',
                                detail: error.message
                            })
                        }
                    })
                } catch (error) {
                    res.status(500).send({
                        error: true,
                        message: 'Begin Transaction Error',
                        detail: error.message
                    })
                }
            })
        } catch (error) {
            res.status(500).send({
                error: true, 
                message: 'Error Multer',
                detail: error.message
            })
        }
    })
})

app.get('/products', (req, res) => {
    db.query(`SELECT p.id, p.name, p.brand, p.price, p.stock, pi.id AS image_id, pi.image FROM products p JOIN
    products_image pi ON pi.products_id = p.id`, (err, result) => {
        try {
            if(err) throw err

            let dataTransformed = []

            result.forEach((value) => {

                let idProductExist = null

                dataTransformed.forEach((val, index) => {
                    if(val.id === value.id){
                        idProductExist = index
                    }
                })

                if(idProductExist === null){
                    dataTransformed.push(
                        {
                            id: value.id,
                            name: value.name,
                            brand: value.brand,
                            stock: value.stock,
                            images: [
                                {
                                    image_id: value.image_id, image: value.image
                                }
                            ]
                        }
                    )
                }else{
                    dataTransformed[idProductExist].images.push(
                        {
                            image_id: value.image_id, image: value.image
                        }
                    )
                }

            })
            
            res.status(200).send({
                error: false,
                message: 'Get Data Success',
                data: dataTransformed
            })
        } catch (error) {
            res.status(500).send({
                error: true,
                message: 'Error When Get Data',
                detail: error.message
            })
        }
    })
})

app.delete('/delete-product/:idProduct', async(req, res) => {
    let idProduct = req.params.idProduct

    // Step2. Initialize All Query
    let query1 = 'SELECT * FROM products WHERE id = ?'
    let query2 = 'SELECT * FROM products_image where products_id = ?'
    let query3 = 'DELETE FROM products_image WHERE products_id = ?'
    let query4 = 'DELETE FROM products WHERE id = ?'

    try {
        if(!idProduct) throw { message: 'Id Product Cannot Null' }

        await query('Start Transaction')
        
        const findProduct = await query(query1, idProduct)
        .catch((error) => {
            throw error
        })

        if(findProduct.length === 0){
            throw { message: 'Id Product Not Found!' }
        }

        const findImages = await query(query2, idProduct)
        .catch((error) => {
            throw error
        })

        // result = [
        //      {image: path1},
        //      {image: path2},
        //      {image: path3}
        // ]
        // Kita Ubah Menjadi :
        // [path1, path2, path3]
        let oldFilesPathLocation = findImages.map((value) => {
            return value.image.replace('http://localhost:5000/', '')
        })

        console.log(oldFilesPathLocation)

        const deleteImages = await query(query3, idProduct)
        .catch((error) => {
            throw error
        })

        const deleteProduct = await query(query4, idProduct)
        .catch((error) => {
            throw error
        })

        deleteFiles(oldFilesPathLocation)

        await query('Commit')
        res.status(200).send({
            error: false,
            message: 'Delete Product Success!'
        })
    } catch (error) {
        await query('Rollback')
        res.status(500).send({
            error: true,
            message: 'Error Delete Product',
            detail: error.message
        })
    }
})

// ########## Update Per-Image
app.patch('/update-image/:idImage', async(req, res) => {
    const idImage = req.params.idImage

    // Initialize Query
    let query1 = 'SELECT * FROM products_image WHERE id = ?'
    let query2 = 'UPDATE products_image SET ? WHERE id = ?'

    let newFilePathLocation
    let newFilePathLocationToDelete
    try {
        const singleUploadAwait = util.promisify(singleUpload).bind(singleUpload)
        await singleUploadAwait(req, res)
        if(req.files.length === 0 || req.files === undefined) throw { message: 'File Not Found' }
        newFilePathLocation = 'http://localhost:5000/' + req.files[0].path
        newFilePathLocationToDelete = [req.files[0].path] 
        console.log(newFilePathLocation)
        await query('Start Transaction')
        const findImage = await query(query1, idImage)
        .catch((error) => {
            throw error
        })

        if(findImage.length === 0) throw { message: 'Id Image Not Found' }

        let oldFilePathLocation = [findImage[0].image.replace('http://localhost:5000/', '')] // Untuk Nge-Delete Image yg Lama

        const updateImage = await query(query2, [{image: newFilePathLocation}, idImage])
        .catch((error) => {
            throw error
        })

        deleteFiles(oldFilePathLocation)

        await query('Commit')
        res.status(200).send({
            error: false,
            message: 'Update Image Success'
        })
    } catch (error) {
        console.log(error)
        await query('Rollback')
        if(newFilePathLocation){
            deleteFiles(newFilePathLocationToDelete)
        }
        res.status(500).send({
            error: true,
            message: 'Error Update Image',
            detail: error.message
        })
    }
})

app.listen(PORT, () => console.log('API RUNNING ON PORT ' + PORT))