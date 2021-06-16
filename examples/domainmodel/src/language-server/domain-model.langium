grammar DomainModel hidden(WS)

terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal INT returns number: /[0-9]+/;
terminal STRING: /"[^"]*"|'[^']*'/;


Domainmodel:
    {Domainmodel}
    (elements+=AbstractElement)*;
 
PackageDeclaration:
    'package' name=QualifiedName '{'
        (elements+=AbstractElement)*
    '}';
 
AbstractElement:
    PackageDeclaration | Type | Import;
 
QualifiedName:
    ID ('.' ID)*;
 
Import:
    'import' importedNamespace=QualifiedNameWithWildcard;
 
QualifiedNameWithWildcard:
    QualifiedName '.*'?;
 
Type:
    DataType | Entity;
 
DataType:
    'datatype' name=ID;
 
Entity:
    'entity' name=ID ('extends' superType=[Entity|QualifiedName])? '{'
        (features+=Feature)*
    '}';
 
Feature:
    (many?='many')? name=ID ':' type=[Type|QualifiedName];