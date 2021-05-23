app.delete('/delete-product/:idProduct', async(req, res) => {
    let idProduct = req.params.idProduct

    let query1 = 'SELECT * FROM products WHERE id = ?'
    let query2 = 'SELECT * FROM products_image WHERE products_id = ?'
    let query3 = 'DELETE FROM products_image WHERE products_id = ?'
    let query4 = 'DELETE FROM products WHERE id = ?'
    try {
        if(!idProduct) throw { message: 'Id Product Cannot Null' }

        const findProduct = await query(query1, idProduct)
        .catch(error => {
            throw error
        })

        console.log(findProduct)
    } catch (error) {
        res.status(500).send({
            error: true,
            message: 'Error',
            detail: error.message
        })
    }
})