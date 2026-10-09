/** Pick a fresh sibling path; existing exports and user files are never replaced. */
export async function availablePackagePath(target:string,readme:boolean,exists:(path:string)=>Promise<boolean>):Promise<string>{
 target=target.replace(/\\/g,'/');
 if(!await exists(target))return target;
 const slash=target.lastIndexOf('/'),dot=target.lastIndexOf('.'),hasExtension=dot>slash,stem=hasExtension?target.slice(0,dot):target,extension=hasExtension?target.slice(dot):'';
 let attempt=1,path='';do{const suffix=readme?(attempt===1?'.pcs':'.pcs-'+attempt):(attempt===1?'.pcs-new':'.pcs-new-'+attempt);path=stem+suffix+extension;attempt++;}while(await exists(path));return path;
}
