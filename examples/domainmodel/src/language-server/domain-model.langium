grammar DomainModel

entry Domainmodel:
    (elements+=AbstractElement)*;

AbstractElement:
    PackageDeclaration | Type;

PackageDeclaration:
    'package' name=QualifiedName '{'
        (elements+=AbstractElement)*
    '}';

Type:
    DataType | Entity;

DataType:
    'datatype' name=ID;

Entity:
    'entity' name=ID ('extends' superType=[+Entity:QualifiedName])? '{'
        (features+=Feature)*
    '}';

Feature:
    (many?='many')? name=ID ':' type=[Type:QualifiedName];

QualifiedName returns string:
    ID ('.' ID)*;

hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
