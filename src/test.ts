import { Blob, FileReader } from "./index";

try
{
	console.log("input: 01234567890");
	const blob = new Blob(['0','1','2', new Uint8Array([0x33,0x34,0x35]), 67, new Uint8Array([0x38,0x39]).buffer]);
	console.log("size: "+blob.size);
	
	const sliced = blob.slice(5,10);
	console.log("sliced size: "+sliced.size);
	

	const datamatched = [];
	
	const reader = new FileReader;
	reader.onloadstart = ()=>console.log('onloadstart');
	reader.onloadend = ()=>console.log('onloadend');
	reader.onload = ()=>console.log('onload: '+JSON.stringify(reader.result));
	reader.onabort = ()=>console.log('onabort');
	reader.onerror = ()=>console.log(reader.error);
	
	reader.readAsArrayBuffer(blob);
	reader.readAsBinaryString(blob);
	reader.readAsDataURL(blob);
	reader.readAsText(blob);

	reader.readAsArrayBuffer(sliced);
	reader.readAsBinaryString(sliced);
	reader.readAsDataURL(sliced);
	reader.readAsText(sliced);
	
}
catch(err)
{
	console.error(err);
}