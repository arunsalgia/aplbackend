var ROOTDIR="";
function getRootDir() {
  if (ROOTDIR === "")
    ROOTDIR = process.cwd() + "/"
  return ROOTDIR;
} 

function getFileName(productName, productVersion, productType) {
  let myFile = getRootDir() + ARCHIVEDIR + 
    productName + "_" + 
    productVersion + "." + 
    productType;
  return myFile 
}

function fileExist(myFile) {
  status = fs.existsSync(myFile)
  return status;
}

function renameFile(oldfile, newFile) {
  // if new file already exists delete it
  if (fileExist(newFile))
    fs.unlinkSync(newFile);

    // now rename the file
  fs.renameSync(oldfile, newFile);
}


function nnn(sss) {
  let num = 0;
  // console.log("String os ", sss);
  if (sss)
  if (sss.length > 0)
    num = parseInt(sss);
  // console.log("number is ", num);
  return num;
}

function setVersionNumber(verNo) {
  let myStr = Math.trunc(verNo/10000).toString() + ".";
  verNo = verNo % 10000;
  myStr = myStr = Math.trunc(verNo/100).toString() + ".";
  verNo = verNo % 100;
  myStr = myStr + verNo.toString();
  return myStr;
}

function getVersionNumber(verStr) {
  let myNumber = 0;
  let tmp = verStr.split(".");
  // console.log("Tmp length ", tmp.length);
  if (tmp.length ===  3) {
    let num1 = nnn(tmp[0]);
    let num2 = nnn(tmp[1]);
    let num3 = nnn(tmp[2]);
    // console.log("Indi version ", num1, num2,  num3);
    myNumber = num1 * 10000 + num2 * 100 + num3;
  }
  return myNumber;
}

async function cleanup() {
    let allProducts = await Product.find({});
    for(p=0; p<allProducts.length; ++p) {
        let prod = allProducts[p];
        // console.log(prod);
        let myFile = getFileName(prod.name, prod.versionNumber, prod.type);
        // console.log(myFile);
        if (!fileExist(myFile)) {
            // console.log("File does not exists deleteing");
            // console.log(prod.name, prod.versionNumber, prod.type );
            await Product.deleteOne({
                name: prod.name,
                versionNumber: prod.versionNumber,
                type: prod.type 
            });
        } else {
            // console.log("File found");
        }
    };
}


module.exports =  
{ 
    getRootDir, getFileName, fileExist, renameFile, 
    setVersionNumber, getVersionNumber, 
    cleanup,
};
  